using UnityEngine;

namespace AliveThings.Interaction
{
    /// <summary>
    /// Drives the jelly deformation in Shaders/JellyDeform.hlsl.
    /// Fingertip touches the mesh → dent at that point, spring back, whole-body wobble.
    /// Works on any renderer whose material exposes _PokePos, _PokeAmt, _Wobble.
    /// </summary>
    public class JellyPoke : MonoBehaviour
    {
        public Renderer target;
        public float touchRadius = 0.02f;
        public float stiffness = 70f, damping = 6f;
        public float dentDepth = 1f;

        static readonly int PokePos = Shader.PropertyToID("_PokePos");
        static readonly int PokeAmt = Shader.PropertyToID("_PokeAmt");
        static readonly int Wobble = Shader.PropertyToID("_Wobble");

        MaterialPropertyBlock block;
        Collider col;
        float amt, vel, wobble;
        Vector3 pokeLocal;
        bool wasTouching;

        void Awake() { block = new MaterialPropertyBlock(); if (target == null) target = GetComponentInChildren<Renderer>(); col = target.GetComponent<Collider>(); }

        void Update()
        {
            float dt = Time.deltaTime;
            var input = HandInput.Instance;
            bool touching = false;
            if (input != null && col != null)
            {
                foreach (var h in new[] { input.Left, input.Right })
                {
                    if (!h.tracked) continue;
                    Vector3 closest = col.ClosestPoint(h.indexTip);
                    if (Vector3.Distance(closest, h.indexTip) < touchRadius)
                    {
                        touching = true;
                        pokeLocal = target.transform.InverseTransformPoint(closest);
                        if (!wasTouching) { vel += 5f; wobble = 0.07f; OnTouch(h.indexTip - closest); }
                        break;
                    }
                }
            }
            wasTouching = touching;

            // spring
            vel += (-stiffness * amt - damping * vel) * dt;
            amt += vel * dt;
            wobble *= Mathf.Pow(0.08f, dt);

            target.GetPropertyBlock(block);
            block.SetVector(PokePos, pokeLocal);
            block.SetFloat(PokeAmt, Mathf.Max(0f, amt) * dentDepth);
            block.SetFloat(Wobble, wobble);
            target.SetPropertyBlock(block);
        }

        void OnTouch(Vector3 fromDirection)
        {
            var brain = GetComponentInParent<Creature.CreatureBrain>();
            if (brain != null) brain.OnPoked(fromDirection);
        }
    }
}
