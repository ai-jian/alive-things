// 3渲2 relief shading for Shader Graph (URP Unlit graph; we do the lighting ourselves).
// Two Custom Function nodes (File mode), both from this file:
//
//   HeightToNormal   inputs: HeightTex (Texture2D), Sampler, UV, Texel (float2), Bump (float),
//                            NormalWS, TangentWS, BitangentWS
//                    output: NormalOut (float3)   -> use as the shading normal below
//   ToonRelief       inputs: NormalWS (from above), ViewDirWS, LightDirWS, Height (float, sampled at UV),
//                            Clay, Shadow, Light, Rim, Glaze (float3), GlazeOn (float), Ambient (float)
//                    output: Color (float3)
//
// Vertex displacement: in the vertex stage sample HeightTex at UV (Sample Texture 2D LOD),
// multiply by _Displace and add along the object normal to Position. The inflated capture mesh is
// dense enough; for the ready-made objects use a subdivided mesh.
//
// Material properties to expose: _HeightTex, _Displace (0.003 m is a good start), _Bump (2),
// _Clay, _Shadow, _Light, _Rim, _Glaze, _GlazeOn, _Ambient, plus _PokePos/_PokeAmt/_Wobble from JellyDeform.

#ifndef ALIVE_TOON_RELIEF
#define ALIVE_TOON_RELIEF

void HeightToNormal_float(UnityTexture2D HeightTex, UnitySamplerState Sampler, float2 UV, float2 Texel, float Bump,
                          float3 NormalWS, float3 TangentWS, float3 BitangentWS, out float3 NormalOut)
{
    float hx = SAMPLE_TEXTURE2D(HeightTex, Sampler, UV + float2(Texel.x, 0)).r - SAMPLE_TEXTURE2D(HeightTex, Sampler, UV - float2(Texel.x, 0)).r;
    float hy = SAMPLE_TEXTURE2D(HeightTex, Sampler, UV + float2(0, Texel.y)).r - SAMPLE_TEXTURE2D(HeightTex, Sampler, UV - float2(0, Texel.y)).r;
    NormalOut = normalize(NormalWS - TangentWS * hx * Bump * 40.0 - BitangentWS * hy * Bump * 40.0);
}

void ToonRelief_float(float3 NormalWS, float3 ViewDirWS, float3 LightDirWS, float Height,
                      float3 Clay, float3 Shadow, float3 Light, float3 Rim, float3 Glaze, float GlazeOn, float Ambient,
                      out float3 Color)
{
    float3 N = normalize(NormalWS), V = normalize(ViewDirWS), L = normalize(LightDirWS);
    float ndl = dot(N, L);

    // three bands with soft edges: shadow / mid / light
    float band = smoothstep(-0.05, 0.02, ndl) * 0.5 + smoothstep(0.42, 0.48, ndl) * 0.5;
    // grooves catch shadow, ridges catch light (a cheap height-based occlusion)
    band = saturate(band + Height * 1.2);

    float3 base = Clay;
    if (GlazeOn > 0.5) base = lerp(base, Glaze, smoothstep(0.0, 0.25, -Height));   // glaze pools in grooves

    float3 lit = lerp(Shadow, Light, band) * base + Ambient * base * 0.2;

    float3 H = normalize(L + V);
    float spec = step(0.985, dot(N, H)) * 0.35;                                       // one hard highlight dot
    float rim = pow(1.0 - saturate(dot(N, V)), 3.0) * (1.0 - smoothstep(0.2, 0.5, ndl)) * 0.45; // cool rim on the dark side

    Color = lit + spec * Light + rim * Rim;
}

#endif
