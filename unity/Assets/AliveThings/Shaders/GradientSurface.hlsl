// Whole-body gradient surface (the decided look). For a URP Unlit Shader Graph, one Custom Function node (File mode):
//
//   GradientSurface  inputs: Intensity (float, sampled from _IntensityTex at UV), PositionWS (float3), NormalWS, LightDirWS,
//                            MinY, MaxY (float, world-space bottom/top of the creature), BaseLo, BaseHi (float, 0.10 / 0.55),
//                            Shade (float, 0.16), Glow (float, 0 in the room, 1 in My Space),
//                            Pal0..Pal5 (float3, the object's palette from PaletteFromObject)
//                    output: Color (float3)
//
// Material properties to expose: _IntensityTex, _MinY, _MaxY, _BaseLo, _BaseHi, _Shade, _Glow, _Pal0.._Pal5,
// plus _PokePos/_PokeAmt/_Wobble from JellyDeform.hlsl in the vertex stage.
// Face, feet and handle use the same graph with Intensity = 0 (or a flag) so the body is one gradient.

#ifndef ALIVE_GRADIENT_SURFACE
#define ALIVE_GRADIENT_SURFACE

float3 AlivePalette(float t, float3 p0, float3 p1, float3 p2, float3 p3, float3 p4, float3 p5)
{
    t = clamp(t, 0.0, 1.0) * 5.0;
    float3 a = t < 1 ? p0 : t < 2 ? p1 : t < 3 ? p2 : t < 4 ? p3 : p4;
    float3 b = t < 1 ? p1 : t < 2 ? p2 : t < 3 ? p3 : t < 4 ? p4 : p5;
    return lerp(a, b, frac(min(t, 4.999)));
}

void GradientSurface_float(float Intensity, float3 PositionWS, float3 NormalWS, float3 LightDirWS,
                           float MinY, float MaxY, float BaseLo, float BaseHi, float Shade, float Glow,
                           float3 Pal0, float3 Pal1, float3 Pal2, float3 Pal3, float3 Pal4, float3 Pal5,
                           out float3 Color)
{
    float yy = saturate((PositionWS.y - MinY) / max(MaxY - MinY, 0.001));
    float base = lerp(BaseLo, BaseHi, yy);                                      // deep at the bottom, light at the top
    float lit = smoothstep(-0.25, 0.55, dot(normalize(NormalWS), normalize(LightDirWS)));
    base -= Shade * (1.0 - lit);                                                // shadow side slides DOWN the palette, never grey
    float t = base + Intensity * 0.32;                                          // strokes push up the same gradient, never to white
    float3 col = AlivePalette(t, Pal0, Pal1, Pal2, Pal3, Pal4, Pal5);
    col += AlivePalette(min(t + 0.12, 0.95), Pal0, Pal1, Pal2, Pal3, Pal4, Pal5) * smoothstep(0.0, 0.8, Intensity) * Glow * 0.25;
    Color = col;
}

#endif
