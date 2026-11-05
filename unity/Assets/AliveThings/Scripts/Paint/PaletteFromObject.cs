using UnityEngine;

namespace AliveThings.Paint
{
    /// <summary>
    /// The player never picks colours. The object's own dominant colour becomes a six-stop palette:
    /// deep and slightly hue-shifted at the bottom, the object's colour in the middle, warm light at the top.
    /// For captured objects, feed the photo's dominant colour. For shelf objects, set it in the inspector.
    /// Writes _Pal0.._Pal5 (and _MinY/_MaxY from the renderer bounds) into the renderer's property block.
    /// </summary>
    public class PaletteFromObject : MonoBehaviour
    {
        public Renderer target;
        public Color dominant = new Color(0.93f, 0.88f, 0.78f);   // cream cup by default
        [Tooltip("Hue drift across the ramp in degrees: negative at the deep end, positive at the light end.")]
        public float hueDriftDeep = -25f, hueDriftLight = 22f;

        static readonly int[] PalIds = { Shader.PropertyToID("_Pal0"), Shader.PropertyToID("_Pal1"), Shader.PropertyToID("_Pal2"), Shader.PropertyToID("_Pal3"), Shader.PropertyToID("_Pal4"), Shader.PropertyToID("_Pal5") };
        static readonly int MinY = Shader.PropertyToID("_MinY"), MaxY = Shader.PropertyToID("_MaxY");
        MaterialPropertyBlock block;

        void Start() { Apply(); }

        /// <summary>Call after capture with the photo's dominant colour.</summary>
        public void SetDominant(Color c) { dominant = c; Apply(); }

        public void Apply()
        {
            if (target == null) target = GetComponentInChildren<Renderer>();
            if (target == null) return;
            block = block ?? new MaterialPropertyBlock();
            target.GetPropertyBlock(block);
            var stops = Build(dominant, hueDriftDeep, hueDriftLight);
            for (int i = 0; i < 6; i++) block.SetColor(PalIds[i], stops[i]);
            var b = target.bounds; block.SetFloat(MinY, b.min.y); block.SetFloat(MaxY, b.max.y);
            target.SetPropertyBlock(block);
        }

        /// <summary>Six stops from one colour. Low saturation inputs (white cups, grey books) get a gentle dusk ramp instead of mud.</summary>
        public static Color[] Build(Color dominant, float driftDeep, float driftLight)
        {
            Color.RGBToHSV(dominant, out float h, out float s, out float v);
            if (s < 0.15f) { h = 0.72f; s = 0.35f; }          // near-neutral objects borrow a soft violet-dusk ramp
            float[] vals = { 0.34f, 0.50f, 0.68f, 0.84f, 0.94f, 1.00f };
            float[] sats = { 0.95f, 0.90f, 0.80f, 0.60f, 0.35f, 0.12f };
            float[] drift = { 1f, 0.6f, 0f, -0.4f, -0.8f, -1f };
            var outp = new Color[6];
            for (int i = 0; i < 6; i++)
            {
                float d = drift[i] > 0 ? driftDeep * drift[i] : driftLight * -drift[i];
                float hh = Mathf.Repeat(h + d / 360f, 1f);
                outp[i] = Color.HSVToRGB(hh, Mathf.Clamp01(s * sats[i] + (i >= 4 ? 0.05f : 0f)), Mathf.Clamp01(vals[i]));
            }
            return outp;
        }

        /// <summary>Dominant colour of a photo region: average of the mask pixels, biased toward saturated ones.</summary>
        public static Color Dominant(Color32[] pixels, bool[] mask)
        {
            double r = 0, g = 0, b = 0, w = 0;
            for (int i = 0; i < pixels.Length; i++)
            {
                if (mask != null && !mask[i]) continue;
                var p = pixels[i]; Color.RGBToHSV(p, out _, out float s, out float v);
                double wt = 0.2 + s * 0.8 * v;             // greys count a little, colours count more
                r += p.r * wt; g += p.g * wt; b += p.b * wt; w += wt;
            }
            if (w <= 0) return Color.gray;
            return new Color((float)(r / w / 255.0), (float)(g / w / 255.0), (float)(b / w / 255.0));
        }
    }
}
