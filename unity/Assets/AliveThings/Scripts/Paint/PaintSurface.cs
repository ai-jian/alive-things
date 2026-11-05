using UnityEngine;

namespace AliveThings.Paint
{
    /// <summary>
    /// The decal layer that sits over the object's captured photo texture.
    /// A RenderTexture the ZenBrush stamps into. The material should blend
    /// _PaintTex over _BaseMap (alpha over). Keeps per-pattern counts for traits and whispers.
    /// </summary>
    public class PaintSurface : MonoBehaviour
    {
        public Renderer target;
        public int resolution = 1024;
        public Material stampMaterial;      // unlit, alpha blended; draws one sprite into the RT

        [HideInInspector] public int[] patternCounts = new int[ZenBrush.PatternCount];
        [HideInInspector] public float coverage;    // 0..1, estimated from stamps placed

        public RenderTexture Texture { get; private set; }
        static readonly int PaintTex = Shader.PropertyToID("_PaintTex");
        MaterialPropertyBlock block;
        int stamps;

        void Awake()
        {
            if (target == null) target = GetComponentInChildren<Renderer>();
            Texture = new RenderTexture(resolution, resolution, 0, RenderTextureFormat.ARGB32) { wrapMode = TextureWrapMode.Repeat };
            Clear();
            block = new MaterialPropertyBlock();
            target.GetPropertyBlock(block);
            block.SetTexture(PaintTex, Texture);
            target.SetPropertyBlock(block);
        }

        public void Clear()
        {
            var prev = RenderTexture.active; RenderTexture.active = Texture;
            GL.Clear(true, true, Color.clear);
            RenderTexture.active = prev;
            stamps = 0; coverage = 0; System.Array.Clear(patternCounts, 0, patternCounts.Length);
        }

        /// <summary>Draw one pattern unit at a UV with rotation and size (UV units).</summary>
        public void Stamp(Texture2D sprite, Vector2 uv, float angleDeg, float size, Color tint, int patternIndex)
        {
            if (stampMaterial == null || sprite == null) return;
            var prev = RenderTexture.active; RenderTexture.active = Texture;
            GL.PushMatrix(); GL.LoadPixelMatrix(0, 1, 0, 1);  // UV space
            stampMaterial.mainTexture = sprite; stampMaterial.color = tint; stampMaterial.SetPass(0);
            float h = size * 0.5f, c = Mathf.Cos(angleDeg * Mathf.Deg2Rad), s = Mathf.Sin(angleDeg * Mathf.Deg2Rad);
            GL.Begin(GL.QUADS);
            Quad(uv, -h, -h, c, s, 0, 0); Quad(uv, h, -h, c, s, 1, 0); Quad(uv, h, h, c, s, 1, 1); Quad(uv, -h, h, c, s, 0, 1);
            GL.End(); GL.PopMatrix();
            RenderTexture.active = prev;

            stamps++;
            if (patternIndex >= 0 && patternIndex < patternCounts.Length) patternCounts[patternIndex]++;
            coverage = Mathf.Clamp01(coverage + size * size * 0.6f);   // rough; a unit covers ~60% of its square
        }

        /// <summary>Water gesture: soften what is under the palm instead of erasing it.
        /// TODO: ping-pong Gaussian blur restricted to a disc around uv. Until then, no-op.</summary>
        public void Soften(Vector2 uv, float radius, float amount) { }

        static void Quad(Vector2 o, float x, float y, float c, float s, float u, float v)
        {
            GL.TexCoord2(u, v);
            GL.Vertex3(o.x + x * c - y * s, o.y + x * s + y * c, 0);
        }

        void OnDestroy() { if (Texture != null) Texture.Release(); }
    }
}
