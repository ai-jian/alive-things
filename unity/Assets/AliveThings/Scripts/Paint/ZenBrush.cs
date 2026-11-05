using System.Collections.Generic;
using UnityEngine;

namespace AliveThings.Paint
{
    /// <summary>
    /// The "anyone can draw" brush, final design (Nov 5). No menus, no pattern list.
    ///  - Fingertip on the surface → a line. Width from slowness, press depth and a taper-in.
    ///  - Tap → a dot.
    ///  - Hold still while touching → ink pools and blooms (adds water).
    ///  - Press and hold 0.6 s before moving → sets the mandala centre (ripple).
    ///  - Two fingertips on the surface and twist → fold 4/6/8/12.
    ///  - Flat palm → water (softens, never erases).
    /// Every mark goes through the composite symmetry guide: 2 around the axis × N mandala × mirror.
    /// Works on lathe-like objects (cups, bowls, vases) out of the box; other shapes still paint, the
    /// "around" copies just land where the UV says.
    /// </summary>
    [RequireComponent(typeof(PaintSurface))]
    public class ZenBrush : MonoBehaviour
    {
        [Header("Guide")]
        public int around = 2;
        public int mandala = 6;
        public bool mirror = true;
        public Vector2 centreUV = new Vector2(0f, 0.5f);
        static readonly int[] Folds = { 4, 6, 8, 12 };

        [Header("Feel")]
        public float touchDistance = 0.012f;      // m, how close the tip must be to count as touching
        public float maxDepth = 0.02f;            // m, press this deep for full width
        public float spacingUV = 0.006f;          // distance between stamps in U
        public float minRadius = 0.004f, maxRadius = 0.016f;   // UV units (U), like 4..16 px of 1024
        public float longPressSeconds = 0.6f;
        public float dwellSeconds = 0.15f;
        public AudioSource tick; public AudioClip tickClip;

        [HideInInspector] public Creature.StrokeStats stats;

        PaintSurface surface; Collider col;
        // texture aspect for the mandala rotation: U is "around", V is "up". For a lathe object the physical
        // size of one U unit is the circumference, of one V unit the wall height. Set from the mesh bounds.
        float pxX = 1f, pxY = 1f;

        // stroke state
        bool down, pressDone; float downT, lastMoveT, strokeLen, smoothSpeed, speedAccum; int speedSamples, dots, stampsTotal; float turnAccum, dwellTotal;
        Vector2 lastUV; bool hasLast; Vector3 lastDirUV;
        // twist state
        bool twisting; float twistAngle0, twistAcc;

        void Start()
        {
            surface = GetComponent<PaintSurface>();
            col = surface.target.GetComponent<Collider>();
            var b = surface.target.bounds; float circumference = Mathf.PI * (b.size.x + b.size.z) * 0.5f;
            pxX = 1f / Mathf.Max(circumference, 0.01f); pxY = 1f / Mathf.Max(b.size.y, 0.01f);   // UV per metre
        }

        void Update()
        {
            var input = Interaction.HandInput.Instance; if (input == null || col == null) return;
            surface.Tick(Time.deltaTime);
            var R = input.Right; var L = input.Left;

            // water: an open palm near the surface
            foreach (var h in new[] { R, L })
                if (h.tracked && h.IsOpenPalm && Near(h.palm, touchDistance * 3f) && TryUV(col.ClosestPoint(h.palm), out Vector2 puv))
                    surface.AddWet(puv, 0.05f, Time.deltaTime * 1.5f);

            // twist: both index tips on the surface
            bool bothOn = R.tracked && L.tracked && Near(R.indexTip, touchDistance) && Near(L.indexTip, touchDistance);
            if (bothOn)
            {
                Vector3 d = L.indexTip - R.indexTip; float ang = Mathf.Atan2(Vector3.Dot(d, transform.up), Vector3.Dot(d, transform.right));
                if (!twisting) { twisting = true; twistAngle0 = ang; twistAcc = 0; EndStroke(); }
                float delta = Mathf.DeltaAngle(twistAngle0 * Mathf.Rad2Deg, ang * Mathf.Rad2Deg); twistAngle0 = ang; twistAcc += delta;
                const float step = 36f;
                while (twistAcc > step) { twistAcc -= step; StepFold(+1); }
                while (twistAcc < -step) { twistAcc += step; StepFold(-1); }
                return;
            }
            twisting = false;

            // paint with whichever index is touching (prefer right)
            var hand = R.tracked && Near(R.indexTip, touchDistance) ? R : (L.tracked && Near(L.indexTip, touchDistance) ? L : default);
            if (!hand.tracked || hand.IsPinching) { EndStroke(); return; }
            Vector3 onSurface = col.ClosestPoint(hand.indexTip);
            if (!TryUV(onSurface, out Vector2 uv)) { EndStroke(); return; }
            float depth = Depth(hand.indexTip);
            if (!down) BeginStroke(uv);
            Continue(uv, depth);
        }

        void BeginStroke(Vector2 uv) { down = true; pressDone = false; downT = lastMoveT = Time.time; strokeLen = 0; smoothSpeed = 0; hasLast = true; lastUV = uv; }

        void Continue(Vector2 uv, float depth)
        {
            float now = Time.time;
            Vector2 d = uv - lastUV; if (d.x > 0.5f) d.x -= 1f; if (d.x < -0.5f) d.x += 1f;
            float len = d.magnitude;

            if (len < spacingUV)
            {
                // still: long press sets the centre; after that, dwell adds water
                if (!pressDone && strokeLen == 0 && now - downT > longPressSeconds) { pressDone = true; centreUV = uv; OnCentreSet(uv); }
                else if (pressDone) { /* centre already set this press; do nothing */ }
                else if (now - lastMoveT > dwellSeconds && strokeLen > 0) { float r = 0.01f + Mathf.Min(0.03f, (now - lastMoveT) * 0.025f); surface.AddWet(lastUV, r, Time.deltaTime * 1.5f); dwellTotal += Time.deltaTime; }
                return;
            }
            if (pressDone) return;   // a centre press is not a stroke

            float speed = len / Mathf.Max(Time.deltaTime, 1e-4f) / pxX;   // metres per second along the surface
            smoothSpeed = smoothSpeed * 0.6f + speed * 0.4f; speedAccum += speed; speedSamples++; lastMoveT = now;
            float slow = 1f - Mathf.Clamp01(smoothSpeed / 0.5f);
            float taperIn = Mathf.Clamp01(strokeLen / 0.03f);
            float press = 0.6f + 0.8f * Mathf.Clamp01(depth / maxDepth);
            float radius = Mathf.Lerp(minRadius, maxRadius, slow) * (0.35f + 0.65f * taperIn) * press;
            float strength = (0.3f + 0.7f * slow) * (0.4f + 0.6f * taperIn);

            Vector2 dir = d / len;
            if (hasLast && lastDirUV != Vector3.zero) turnAccum += Mathf.Abs(Vector2.SignedAngle(lastDirUV, dir));
            lastDirUV = dir;
            Vector2 next = lastUV + dir * spacingUV; next.x = Mathf.Repeat(next.x, 1f);
            Symmetric(next, radius, strength);
            lastUV = next; strokeLen += spacingUV; stampsTotal++;
            Tick();
        }

        void EndStroke()
        {
            if (!down) return;
            if (!pressDone && strokeLen == 0 && Time.time - downT < 0.25f) { Symmetric(lastUV, maxRadius * 0.6f, 1f); dots++; stampsTotal++; Tick(); }   // a tap is a dot
            down = false; hasLast = false; lastDirUV = Vector3.zero;
            UpdateStats();
        }

        /// <summary>The guide: around × mandala × mirror, in UV space with the lathe aspect applied.</summary>
        void Symmetric(Vector2 uv, float radius, float strength)
        {
            float dx = uv.x - centreUV.x; if (dx > 0.5f) dx -= 1f; if (dx < -0.5f) dx += 1f;
            float px = dx / pxX, py = (uv.y - centreUV.y) / pxY;              // metres from the centre
            var local = new List<Vector2>(mandala * 2);
            for (int k = 0; k < mandala; k++)
            {
                float a = k * Mathf.PI * 2f / mandala, c = Mathf.Cos(a), s = Mathf.Sin(a);
                local.Add(new Vector2(px * c - py * s, px * s + py * c));
                if (mirror) local.Add(new Vector2(-px * c - py * s, -px * s + py * c));
            }
            for (int j = 0; j < around; j++)
            {
                float shift = (float)j / around;
                foreach (var l in local)
                {
                    var p = new Vector2(Mathf.Repeat(centreUV.x + shift + l.x * pxX, 1f), centreUV.y + l.y * pxY);
                    if (p.y < 0.02f || p.y > 0.98f) continue;
                    surface.Stamp(p, radius, strength);
                }
            }
        }

        void StepFold(int dirn) { int i = System.Array.IndexOf(Folds, mandala); if (i < 0) i = 1; mandala = Folds[(i + dirn + Folds.Length) % Folds.Length]; OnFoldChanged(mandala); }

        /// <summary>Hook visuals here: a ripple on the surface at the new centre.</summary>
        protected virtual void OnCentreSet(Vector2 uv) { Haptics.Pulse(0.4f, 0.06f); }
        /// <summary>Hook visuals here: spokes flash around the centre.</summary>
        protected virtual void OnFoldChanged(int fold) { Haptics.Pulse(0.25f, 0.03f); }

        bool Near(Vector3 p, float r) => Vector3.Distance(col.ClosestPoint(p), p) <= r;

        /// <summary>How far the fingertip is pressed into the wall. Lathe assumption: compare radial distances from the object's axis.</summary>
        float Depth(Vector3 tip)
        {
            Vector3 axisPoint = new Vector3(transform.position.x, tip.y, transform.position.z);
            Vector3 radial = tip - axisPoint; radial.y = 0; if (radial.sqrMagnitude < 1e-6f) return 0f;
            Vector3 outside = tip + radial.normalized * 0.05f;
            if (col.Raycast(new Ray(outside, -radial.normalized), out RaycastHit hit, 0.1f))
                return Mathf.Max(0f, Vector3.Distance(hit.point, axisPoint) - radial.magnitude);
            return 0f;
        }

        bool TryUV(Vector3 worldPos, out Vector2 uv)
        {
            uv = default;
            Vector3 inward = transform.position - worldPos; inward.y = 0;
            if (inward.sqrMagnitude < 1e-6f) return false;
            Vector3 origin = worldPos - inward.normalized * 0.01f;
            if (col.Raycast(new Ray(origin, inward.normalized), out RaycastHit hit, 0.1f)) { uv = hit.textureCoord; return true; }
            return false;
        }

        void Tick() { if (tick != null && tickClip != null) { tick.pitch = Random.Range(0.95f, 1.05f); tick.PlayOneShot(tickClip, 0.3f); } Haptics.Pulse(0.12f, 0.015f); }

        void UpdateStats()
        {
            stats = new Creature.StrokeStats
            {
                averageSpeed = speedSamples > 0 ? speedAccum / speedSamples : 0,
                coverage = surface.coverage,
                dotRatio = stampsTotal > 0 ? (float)dots / stampsTotal : 0,
                turnRatio = stampsTotal > 0 ? Mathf.Clamp01(turnAccum / (stampsTotal * 20f)) : 0,
                dwellRatio = Mathf.Clamp01(dwellTotal / Mathf.Max(1f, Time.time - downT + dwellTotal)),
                unitCount = stampsTotal,
            };
        }
    }

    /// <summary>Tiny haptics shim. Replace the body with the hand haptics API when the Meta SDK is in.</summary>
    public static class Haptics { public static void Pulse(float amplitude, float seconds) { } }
}
