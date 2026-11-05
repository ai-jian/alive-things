// Jelly deformation for Shader Graph.
// Add a Custom Function node (File mode), point it at this file, name "JellyDeform",
// inputs: Position (object space), Normal (object space), PokePos, PokeAmt, Wobble, Time.
// Output: Out (float3). Plug Out into the Vertex Position of a URP Lit graph.
// Expose _PokePos (Vector3), _PokeAmt (Float), _Wobble (Float) as material properties
// so Interaction/JellyPoke.cs can drive them through a MaterialPropertyBlock.

#ifndef ALIVE_JELLY_DEFORM
#define ALIVE_JELLY_DEFORM

void JellyDeform_float(float3 Position, float3 Normal, float3 PokePos, float PokeAmt, float Wobble, float Time, out float3 Out)
{
    float3 p = Position;

    // dent: push vertices near the poke point inward along their normal
    float d = distance(p, PokePos);
    float f = smoothstep(0.08, 0.0, d);          // 8 cm falloff in object units, scale to taste
    p -= Normal * f * PokeAmt * 0.03;

    // whole-body wobble: a travelling squash wave that fades out
    float w = sin(Time * 9.0 + p.y * 40.0) * Wobble;
    p.x *= 1.0 + w;
    p.z *= 1.0 + w;
    p.y *= 1.0 - w * 0.8;

    Out = p;
}

#endif
