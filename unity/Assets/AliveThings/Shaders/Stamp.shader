// Additive soft disc into a single-channel RT. Pass 0 = intensity (uses _Strength), pass 1 = wet (uses _WetMul).
Shader "AliveThings/Stamp"
{
    Properties { _Strength ("Strength", Float) = 0.12  _WetMul ("Wet multiplier", Float) = 1 }
    SubShader
    {
        Tags { "RenderType"="Opaque" }
        Cull Off ZWrite Off ZTest Always
        Blend One One
        CGINCLUDE
        #include "UnityCG.cginc"
        struct v2f { float4 pos : SV_POSITION; float2 uv : TEXCOORD0; };
        v2f vert (float4 v : POSITION, float2 uv : TEXCOORD0) { v2f o; o.pos = UnityObjectToClipPos(v); o.uv = uv; return o; }
        float disc(float2 uv) { float d = length(uv - 0.5) * 2.0; return exp(-(d*d) / (2.0 * 0.5 * 0.5 * 0.25)); } // gaussian, matches the web test
        ENDCG
        Pass { CGPROGRAM #pragma vertex vert #pragma fragment frag float _Strength; float4 frag (v2f i) : SV_Target { return float4(disc(i.uv) * _Strength, 0, 0, 0); } ENDCG }
        Pass { CGPROGRAM #pragma vertex vert #pragma fragment frag float _WetMul; float4 frag (v2f i) : SV_Target { return float4(disc(i.uv) * _WetMul, 0, 0, 0); } ENDCG }
    }
}
