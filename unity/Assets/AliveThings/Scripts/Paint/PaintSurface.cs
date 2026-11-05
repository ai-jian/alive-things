using UnityEngine;

namespace AliveThings.Paint
{
    /// <summary>
    /// The carving layer. Not colour: a signed HEIGHT map the ZenBrush stamps into.
    /// 0 = flat, positive = ridge, negative = groove. Stored in a half-float RenderTexture
    /// so additive blending can go negative. The relief shader (Shaders/ToonRelief.hlsl)
    /// turns it into displaced vertices and perturbed normals; a toon ramp draws the light.
    /// Keeps per-pattern counts for traits and whispers.
    /// </summary>
    public class PaintSurface : MonoBehaviour
    {
        public Renderer target;
        public int resolution = 1024;
        [Tooltip("Unlit material with Blend One One, Cull Off, ZTest Always. Draws one kernel sprite scaled by a signed strength.")]
        public Material stampMaterial;
        [Tooltip("Blur material for the water gesture: samples _MainTex around the uv and writes the average into a disc.")]
        public Material smoothMaterial;

        [HideInInspector] public int[] patternCounts = new int[ZenBrush.PatternCount];
        [HideInInspector] public float coverage;    // 0..1, estimated from stamps placed

        public RenderTexture Height { get; private set; }
        RenderTexture scratch;
        static readonly int HeightTex = Shader.PropertyToID("_HeightTex");
        static readonly int Strength = Shader.PropertyToID("_Strength");
        MaterialPropertyBlock block;

        void Awake()
        {
            if (target == null) target = GetComponentInChildren<Renderer>();
            var fmt = SystemInfo.SupportsRenderTextureFormat(RenderTextureFormat.RHalf) ? RenderTextureFormat.RHalf : RenderTextureFormat.ARGBHalf;
            Height = new RenderTexture(resolution, resolution, 0, fmt) { wrapMode = TextureWrapMode.Repeat, filterMode = FilterMode.Bilinear };
            scratch = new RenderTexture(Height.descriptor);
            Clear();
            block = new MaterialPropertyBlock();
            target.GetPropertyBlock(block);
            block.SetTexture(HeightTex, Height);
            target.SetPropertyBlock(block);
        }

        public void Clear()
        {
            var prev = RenderTexture.active; RenderTexture.active = Height;
            GL.Clear(true, true, Color.clear);          // 0 = flat
            RenderTexture.active = prev;
            coverage = 0; System.Array.Clear(patternCounts, 0, patternCounts.Length);
        }

        /// <summary>
        /// Carve one pattern unit. kernel is a grayscale sprite (0.5 = no change, 1 = ridge, 0 = groove) or
        /// a signed sprite if your stamp shader expects that. strength scales depth; slow strokes pass more.
        /// </summary>
        public void Stamp(Texture2D kernel, Vector2 uv, float angleDeg, float size, float strength, int patternIndex)
        {
            if (stampMaterial == null || kernel == null) return;
            var prev = RenderTexture.active; RenderTexture.active = Height;
            GL.PushMatrix(); GL.LoadPixelMatrix(0, 1, 0, 1);  // UV space
            stampMaterial.mainTexture = kernel; stampMaterial.SetFloat(Strength, strength); stampMaterial.SetPass(0);
            float h = size * 0.5f, c = Mathf.Cos(angleDeg * Mathf.Deg2Rad), s = Mathf.Sin(angleDeg * Mathf.Deg2Rad);
            GL.Begin(GL.QUADS);
            Quad(uv, -h, -h, c, s, 0, 0); Quad(uv, h, -h, c, s, 1, 0); Quad(uv, h, h, c, s, 1, 1); Quad(uv, -h, h, c, s, 0, 1);
            GL.End(); GL.PopMatrix();
            RenderTexture.active = prev;

            if (patternIndex >= 0 && patternIndex < patternCounts.Length) patternCounts[patternIndex]++;
            coverage = Mathf.Clamp01(coverage + size * size * 0.6f);
        }

        /// <summary>Water gesture: smooth the relief under the palm. Never erases, only softens, like wet clay.</summary>
        public void Smooth(Vector2 uv, float radius, float amount)
        {
            if (smoothMaterial == null) return;
            smoothMaterial.SetVector("_Disc", new Vector4(uv.x, uv.y, radius, amount));
            Graphics.Blit(Height, scratch, smoothMaterial);
            Graphics.Blit(scratch, Height);
        }

        static void Quad(Vector2 o, float x, float y, float c, float s, float u, float v)
        {
            GL.TexCoord2(u, v);
            GL.Vertex3(o.x + x * c - y * s, o.y + x * s + y * c, 0);
        }

        void OnDestroy() { if (Height != null) Height.Release(); if (scratch != null) scratch.Release(); }
    }
}
