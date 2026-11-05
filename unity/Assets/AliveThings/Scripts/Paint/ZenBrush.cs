using System.Collections.Generic;
using UnityEngine;

namespace AliveThings.Paint
{
    /// <summary>
    /// The "anyone can draw" brush.
    /// The player only provides a path and a rhythm. The brush:
    ///  1. picks a pattern from the motion itself (tap, straight, wavy, circle, flick, scrub),
    ///  2. places repeating units along the path at even spacing,
    ///  3. gently bends the path toward the surface's flow lines (so shaky lines look intentional),
    ///  4. rewards slowness: slow strokes make bigger, more opaque units,
    ///  5. plays a tick and a light haptic per unit.
    /// Fingertip comes from HandInput; hits come from a MeshCollider on the paintable object.
    /// </summary>
    public class ZenBrush : MonoBehaviour
    {
        public enum Pattern { Dot, Stripe, Scallop, Spiral, Leaf, Grid }
        public const int PatternCount = 6;

        public PaintSurface surface;
        public Texture2D[] patternSprites = new Texture2D[PatternCount];
        public Color ink = new Color(0.82f, 0.28f, 0.60f);     // zen pink
        public float touchDistance = 0.015f;
        public float unitSpacing = 0.012f;      // metres along the surface between units
        [Range(0, 1)] public float flowSnap = 0.6f;   // 0 = your line, 1 = fully follows the flow lines
        public AudioSource tick;
        public AudioClip tickClip;

        [HideInInspector] public Creature.StrokeStats stats;

        Collider col;
        readonly List<Vector3> stroke = new List<Vector3>();
        Vector3 lastUnitPos, lastDir;
        float distSinceUnit, strokeStart, speedAccum; int speedSamples;
        int usedMask; int dots, loops;
        bool down;

        void Start() { if (surface == null) surface = GetComponent<PaintSurface>(); col = surface.target.GetComponent<Collider>(); }

        void Update()
        {
            var input = Interaction.HandInput.Instance; if (input == null || col == null) return;
            var h = input.Right.tracked ? input.Right : input.Left;
            if (!h.tracked) { EndStroke(); return; }

            Vector3 tip = h.indexTip;
            Vector3 onSurface = col.ClosestPoint(tip);
            bool touching = Vector3.Distance(onSurface, tip) < touchDistance && !h.IsPinching;

            if (!touching) { EndStroke(); return; }
            if (!down) BeginStroke(onSurface);
            Continue(onSurface);
        }

        void BeginStroke(Vector3 p)
        {
            down = true; stroke.Clear(); stroke.Add(p);
            lastUnitPos = p; lastDir = Vector3.zero; distSinceUnit = 0; strokeStart = Time.time;
        }

        void Continue(Vector3 p)
        {
            Vector3 prev = stroke[stroke.Count - 1];
            float step = Vector3.Distance(prev, p);
            if (step < 0.001f) return;

            // speed for "slow is rewarded"
            float speed = step / Mathf.Max(Time.deltaTime, 1e-4f);
            speedAccum += speed; speedSamples++;

            // bend toward the flow line at this point
            Vector3 dir = (p - prev).normalized;
            Vector3 flow = FlowDirection(p, dir);
            dir = Vector3.Slerp(dir, flow, flowSnap).normalized;
            p = prev + dir * step;
            p = col.ClosestPoint(p);

            stroke.Add(p);
            distSinceUnit += step;

            if (distSinceUnit >= unitSpacing)
            {
                distSinceUnit = 0;
                Pattern pat = Classify();
                float slow = 1f - Mathf.Clamp01(speed / 0.6f);
                float size = Mathf.Lerp(0.02f, 0.045f, slow);                       // UV units
                Color c = ink; c.a = Mathf.Lerp(0.55f, 1f, slow);
                PlaceUnit(pat, p, dir, size, c);
            }
        }

        void EndStroke()
        {
            if (!down) return;
            down = false;
            float dur = Time.time - strokeStart;
            if (dur < 0.2f && stroke.Count < 4) { PlaceUnit(Pattern.Dot, stroke[0], Vector3.forward, 0.03f, ink); } // a tap is a dot
            UpdateStats();
        }

        /// <summary>Which pattern does this motion feel like? Decided from the recent path shape.</summary>
        Pattern Classify()
        {
            int n = stroke.Count; if (n < 6) return Pattern.Stripe;
            // curvature and wiggle over the last ~12 points
            int from = Mathf.Max(1, n - 12); float turn = 0, wiggle = 0; Vector3 pd = Vector3.zero;
            for (int i = from; i < n; i++)
            {
                Vector3 d = (stroke[i] - stroke[i - 1]).normalized;
                if (pd != Vector3.zero) { float a = Vector3.SignedAngle(pd, d, Vector3.up); turn += a; wiggle += Mathf.Abs(a); }
                pd = d;
            }
            float absTurn = Mathf.Abs(turn);
            if (absTurn > 150f) return Pattern.Spiral;                 // kept turning one way: circles
            if (wiggle > 120f && absTurn < 60f) return Pattern.Scallop; // lots of back-and-forth: waves
            if (wiggle > 220f) return Pattern.Grid;                     // frantic scrub: hatch
            float len = Vector3.Distance(stroke[from], stroke[n - 1]);
            if (len > 0.06f && wiggle < 40f) return Pattern.Stripe;    // long and straight
            return Pattern.Leaf;                                        // short curved flick
        }

        void PlaceUnit(Pattern pat, Vector3 worldPos, Vector3 dir, float size, Color c)
        {
            if (!TryUV(worldPos, out Vector2 uv)) return;
            float angle = Mathf.Atan2(dir.z, dir.x) * Mathf.Rad2Deg; // rough; refine with tangent space later
            int idx = (int)pat;
            surface.Stamp(patternSprites[idx], uv, angle, size, c, idx);
            usedMask |= 1 << idx; if (pat == Pattern.Dot) dots++; if (pat == Pattern.Spiral) loops++;
            if (tick != null && tickClip != null) { tick.pitch = Random.Range(0.95f, 1.05f); tick.PlayOneShot(tickClip, 0.35f); }
            Haptics.Pulse(0.15f, 0.02f);
        }

        /// <summary>
        /// Flow lines: for a lathe-like object (cups, bowls, vases) the natural flow is "around" the axis.
        /// For anything else, fall back to the tangent perpendicular to the local up.
        /// </summary>
        Vector3 FlowDirection(Vector3 worldPos, Vector3 currentDir)
        {
            Vector3 axis = surface.transform.up;
            Vector3 radial = Vector3.ProjectOnPlane(worldPos - surface.transform.position, axis);
            Vector3 around = Vector3.Cross(axis, radial).normalized;
            if (around == Vector3.zero) return currentDir;
            // keep the player's sense of direction: don't flip them around
            return Vector3.Dot(around, currentDir) < 0 ? -around : around;
        }

        bool TryUV(Vector3 worldPos, out Vector2 uv)
        {
            uv = default;
            Vector3 inward = (surface.transform.position - worldPos); inward.y = 0;
            if (inward == Vector3.zero) return false;
            Vector3 origin = worldPos - inward.normalized * 0.01f;
            if (col.Raycast(new Ray(origin, inward.normalized), out RaycastHit hit, 0.1f)) { uv = hit.textureCoord; return true; }
            return false;
        }

        void UpdateStats()
        {
            int total = 0; foreach (var n in surface.patternCounts) total += n;
            int used = 0; for (int i = 0; i < PatternCount; i++) if ((usedMask & (1 << i)) != 0) used++;
            stats = new Creature.StrokeStats
            {
                averageSpeed = speedSamples > 0 ? speedAccum / speedSamples : 0,
                coverage = surface.coverage,
                dotRatio = total > 0 ? (float)dots / total : 0,
                loopRatio = total > 0 ? (float)loops / total : 0,
                patternVariety = used / (float)PatternCount,
                unitCount = total,
            };
        }
    }

    /// <summary>Tiny haptics shim. Replace the body with OVRInput.SetControllerVibration or the hand haptics API.</summary>
    public static class Haptics
    {
        public static void Pulse(float amplitude, float seconds) { /* platform call goes here */ }
    }
}
