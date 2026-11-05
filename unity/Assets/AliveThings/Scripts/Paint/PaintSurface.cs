using UnityEngine;

namespace AliveThings.Paint
{
    /// <summary>
    /// The creature's paint layer for the decided look (whole-body gradient, Option A).
    /// Two half-float RenderTextures: Intensity (0..1, what the player laid down) and Wet (0..1,
    /// how fresh the ink is). While wet, a small diffusion blit runs each frame so strokes bloom.
    /// The surface shader (Shaders/GradientSurface.hlsl) maps base gradient + intensity through the
    /// object's own palette. No colour is ever chosen by the player.
    /// </summary>
    public class PaintSurface : MonoBehaviour
    {
        public Renderer target;
        public int resolution = 1024;
        [Tooltip("Shaders/Stamp.shader: additive soft disc. _Strength scales intensity, _WetMul scales wetness.")]
        public Material stampMaterial;
        [Tooltip("Shaders/Diffuse.shader: one diffusion step gated by wetness, plus wet decay.")]
        public Material diffuseMaterial;
        [Range(0, 1)] public float bleed = 0.55f;

        [HideInInspector] public float coverage;   // 0..1 rough estimate of surface touched

        public RenderTexture Intensity { get; private set; }
        public RenderTexture Wet { get; private set; }
        RenderTexture scratchI, scratchW;
        static readonly int IntensityTex = Shader.PropertyToID("_IntensityTex");
        static readonly int WetTex = Shader.PropertyToID("_WetTex");
        static readonly int Strength = Shader.PropertyToID("_Strength");
        static readonly int WetMul = Shader.PropertyToID("_WetMul");
        static readonly int Bleed = Shader.PropertyToID("_Bleed");
        static readonly int Decay = Shader.PropertyToID("_Decay");
        MaterialPropertyBlock block;
        bool anyWet;

        void Awake()
        {
            if (target == null) target = GetComponentInChildren<Renderer>();
            var fmt = SystemInfo.SupportsRenderTextureFormat(RenderTextureFormat.RHalf) ? RenderTextureFormat.RHalf : RenderTextureFormat.ARGBHalf;
            Intensity = Make(fmt); Wet = Make(fmt); scratchI = Make(fmt); scratchW = Make(fmt);
            Clear();
            block = new MaterialPropertyBlock();
            target.GetPropertyBlock(block);
            block.SetTexture(IntensityTex, Intensity);
            target.SetPropertyBlock(block);
        }

        RenderTexture Make(RenderTextureFormat fmt) => new RenderTexture(resolution, resolution / 2, 0, fmt) { wrapMode = TextureWrapMode.Repeat, filterMode = FilterMode.Bilinear };

        public void Clear()
        {
            foreach (var rt in new[] { Intensity, Wet, scratchI, scratchW }) { var prev = RenderTexture.active; RenderTexture.active = rt; GL.Clear(true, true, Color.clear); RenderTexture.active = prev; }
            coverage = 0; anyWet = false;
        }

        /// <summary>Lay down ink: a soft disc at uv. radius in UV units, strength 0..1. Also wets the spot.</summary>
        public void Stamp(Vector2 uv, float radius, float strength)
        {
            if (stampMaterial == null) return;
            stampMaterial.SetFloat(Strength, strength * 0.12f);
            stampMaterial.SetFloat(WetMul, 2f * bleed);
            Draw(Intensity, uv, radius, 0);
            Draw(Wet, uv, radius, 1);
            coverage = Mathf.Clamp01(coverage + radius * radius * 2.5f);
            anyWet = true;
        }

        /// <summary>Dwell: add water only, so the ink already there spreads out.</summary>
        public void AddWet(Vector2 uv, float radius, float amount)
        {
            if (stampMaterial == null) return;
            stampMaterial.SetFloat(WetMul, amount);
            Draw(Wet, uv, radius, 1);
            anyWet = true;
        }

        /// <summary>Call once per frame. One diffusion step where wet, then wet decays.</summary>
        public void Tick(float dt)
        {
            if (!anyWet || diffuseMaterial == null) return;
            diffuseMaterial.SetTexture(WetTex, Wet);
            diffuseMaterial.SetFloat(Bleed, 0.22f * bleed);
            diffuseMaterial.SetFloat(Decay, Mathf.Pow(0.45f, dt));
            Graphics.Blit(Intensity, scratchI, diffuseMaterial, 0);   // pass 0: intensity diffusion
            Graphics.Blit(Wet, scratchW, diffuseMaterial, 1);         // pass 1: wet spread + decay
            Graphics.Blit(scratchI, Intensity); Graphics.Blit(scratchW, Wet);
        }

        void Draw(RenderTexture rt, Vector2 uv, float radius, int pass)
        {
            var prev = RenderTexture.active; RenderTexture.active = rt;
            GL.PushMatrix(); GL.LoadPixelMatrix(0, 1, 0, 1);
            stampMaterial.SetPass(pass);
            float r = radius, ra = radius * 2f;      // texture is 2:1, so the disc needs 2x the V radius to stay round
            GL.Begin(GL.QUADS);
            for (int wrap = -1; wrap <= 1; wrap++)   // draw across the U seam
            {
                float ox = uv.x + wrap;
                if (ox + r < 0 || ox - r > 1) continue;
                GL.TexCoord2(0, 0); GL.Vertex3(ox - r, uv.y - ra, 0);
                GL.TexCoord2(1, 0); GL.Vertex3(ox + r, uv.y - ra, 0);
                GL.TexCoord2(1, 1); GL.Vertex3(ox + r, uv.y + ra, 0);
                GL.TexCoord2(0, 1); GL.Vertex3(ox - r, uv.y + ra, 0);
            }
            GL.End(); GL.PopMatrix();
            RenderTexture.active = prev;
        }

        void OnDestroy() { foreach (var rt in new[] { Intensity, Wet, scratchI, scratchW }) if (rt != null) rt.Release(); }
    }
}
