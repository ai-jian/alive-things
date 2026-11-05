// Ink bleed. Pass 0 blits Intensity: one Laplacian step gated by wetness. Pass 1 blits Wet: spreads to neighbours and decays.
Shader "AliveThings/Diffuse"
{
    Properties { _MainTex ("Source", 2D) = "black" {}  _WetTex ("Wet", 2D) = "black" {}  _Bleed ("Bleed", Float) = 0.12  _Decay ("Decay", Float) = 0.98 }
    SubShader
    {
        Cull Off ZWrite Off ZTest Always
        CGINCLUDE
        #include "UnityCG.cginc"
        sampler2D _MainTex; float4 _MainTex_TexelSize; sampler2D _WetTex; float _Bleed, _Decay;
        struct v2f { float4 pos : SV_POSITION; float2 uv : TEXCOORD0; };
        v2f vert (appdata_img v) { v2f o; o.pos = UnityObjectToClipPos(v.vertex); o.uv = v.texcoord; return o; }
        float4 taps(sampler2D t, float2 uv) {
            float2 e = _MainTex_TexelSize.xy;
            return float4(tex2D(t, uv + float2(e.x, 0)).r, tex2D(t, uv - float2(e.x, 0)).r, tex2D(t, uv + float2(0, e.y)).r, tex2D(t, uv - float2(0, e.y)).r);
        }
        ENDCG
        Pass { CGPROGRAM #pragma vertex vert #pragma fragment frag
            float4 frag (v2f i) : SV_Target {
                float c = tex2D(_MainTex, i.uv).r; float w = tex2D(_WetTex, i.uv).r; if (w < 0.01) return float4(c, 0, 0, 0);
                float4 n = taps(_MainTex, i.uv); float lap = n.x + n.y + n.z + n.w - 4.0 * c;
                return float4(saturate(c + lap * _Bleed * w), 0, 0, 0); }
        ENDCG }
        Pass { CGPROGRAM #pragma vertex vert #pragma fragment frag
            float4 frag (v2f i) : SV_Target {
                float w = tex2D(_MainTex, i.uv).r; float4 n = taps(_MainTex, i.uv);
                float spread = max(max(n.x, n.y), max(n.z, n.w)) * 0.55;        // wet creeps outward so the bloom keeps feathering
                return float4(max(w, spread) * _Decay, 0, 0, 0); }
        ENDCG }
    }
}
