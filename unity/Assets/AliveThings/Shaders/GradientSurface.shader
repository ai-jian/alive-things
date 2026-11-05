// Hand-written URP shader for the creature surface, so no Shader Graph wiring is needed.
// Drag onto a material. PaletteFromObject fills _Pal0.._Pal5/_MinY/_MaxY, PaintSurface fills _IntensityTex,
// JellyPoke fills _PokePos/_PokeAmt/_Wobble, all through MaterialPropertyBlocks.
// For handle / feet / face use the same shader with _UsePaint = 0.
Shader "AliveThings/GradientSurface"
{
    Properties
    {
        _IntensityTex ("Intensity (R)", 2D) = "black" {}
        _UsePaint ("Use paint", Float) = 1
        _MinY ("World bottom", Float) = 0
        _MaxY ("World top", Float) = 1
        _BaseLo ("Base low", Range(0,1)) = 0.10
        _BaseHi ("Base high", Range(0,1)) = 0.55
        _Shade ("Shade slide", Range(0,0.5)) = 0.16
        _Glow ("Glow (My Space)", Range(0,1)) = 0
        _Pal0 ("Palette 0 (deep)", Color) = (0.16,0.16,0.42,1)
        _Pal1 ("Palette 1", Color) = (0.42,0.30,0.58,1)
        _Pal2 ("Palette 2", Color) = (0.76,0.46,0.62,1)
        _Pal3 ("Palette 3", Color) = (0.96,0.64,0.60,1)
        _Pal4 ("Palette 4", Color) = (1.0,0.84,0.72,1)
        _Pal5 ("Palette 5 (light)", Color) = (1.0,0.96,0.88,1)
        _PokePos ("Poke pos (object)", Vector) = (0,0,0,0)
        _PokeAmt ("Poke amount", Float) = 0
        _Wobble ("Wobble", Float) = 0
    }
    SubShader
    {
        Tags { "RenderType"="Opaque" "RenderPipeline"="UniversalPipeline" "Queue"="Geometry" }
        Pass
        {
            Name "Forward"
            Tags { "LightMode"="UniversalForward" }
            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_instancing
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"
            #include "JellyDeform.hlsl"
            #include "GradientSurface.hlsl"

            TEXTURE2D(_IntensityTex); SAMPLER(sampler_IntensityTex);
            CBUFFER_START(UnityPerMaterial)
                float4 _IntensityTex_ST;
                float _UsePaint, _MinY, _MaxY, _BaseLo, _BaseHi, _Shade, _Glow;
                float4 _Pal0, _Pal1, _Pal2, _Pal3, _Pal4, _Pal5;
                float4 _PokePos; float _PokeAmt, _Wobble;
            CBUFFER_END

            struct Attributes { float4 positionOS : POSITION; float3 normalOS : NORMAL; float2 uv : TEXCOORD0; UNITY_VERTEX_INPUT_INSTANCE_ID };
            struct Varyings { float4 positionCS : SV_POSITION; float2 uv : TEXCOORD0; float3 positionWS : TEXCOORD1; float3 normalWS : TEXCOORD2; UNITY_VERTEX_INPUT_INSTANCE_ID };

            Varyings vert (Attributes v)
            {
                Varyings o; UNITY_SETUP_INSTANCE_ID(v); UNITY_TRANSFER_INSTANCE_ID(v, o);
                float3 p; JellyDeform_float(v.positionOS.xyz, v.normalOS, _PokePos.xyz, _PokeAmt, _Wobble, _Time.y, p);
                o.positionWS = TransformObjectToWorld(p);
                o.positionCS = TransformWorldToHClip(o.positionWS);
                o.normalWS = TransformObjectToWorldNormal(v.normalOS);
                o.uv = v.uv;
                return o;
            }

            half4 frag (Varyings i) : SV_Target
            {
                UNITY_SETUP_INSTANCE_ID(i);
                float intensity = _UsePaint > 0.5 ? SAMPLE_TEXTURE2D(_IntensityTex, sampler_IntensityTex, i.uv).r : 0.0;
                Light mainLight = GetMainLight();
                float3 L = mainLight.direction; if (dot(L, L) < 0.001) L = float3(0.5, 0.8, 0.6);
                float3 col;
                GradientSurface_float(intensity, i.positionWS, i.normalWS, L, _MinY, _MaxY, _BaseLo, _BaseHi, _Shade, _Glow,
                                      _Pal0.rgb, _Pal1.rgb, _Pal2.rgb, _Pal3.rgb, _Pal4.rgb, _Pal5.rgb, col);
                return half4(col, 1);
            }
            ENDHLSL
        }
        // depth / shadow passes so the creature occludes and casts in URP
        UsePass "Universal Render Pipeline/Unlit/DepthOnly"
    }
    FallBack "Universal Render Pipeline/Unlit"
}
