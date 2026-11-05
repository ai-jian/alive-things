using UnityEngine;

namespace AliveThings.Creature
{
    /// <summary>
    /// Visual layer of a creature: bob, waddle, blink, bounce, flinch, nap.
    /// Pure transform animation so any captured mesh works without a rig.
    /// </summary>
    public class CreatureBody : MonoBehaviour
    {
        [Header("Parts (optional)")]
        public Transform visual;      // the mesh root; bobs and squashes
        public Transform eyes;        // scaled on Y to blink
        public Transform[] feet;      // swing when walking
        public Transform lightPool;   // warm disc under the creature in My Space

        [Header("Feel")]
        public float bobAmount = 0.015f;
        public float waddleAmount = 6f;      // degrees
        public float turnSpeed = 6f;

        CreatureBrain.State motion;
        float blinkTimer = 2f, t;
        Vector3 baseScale = Vector3.one;
        Vector3 bounceVel; float bounce;
        Quaternion faceDir;

        void Awake()
        {
            if (visual == null) visual = transform;
            baseScale = visual.localScale;
            faceDir = transform.rotation;
        }

        public void SetMotion(CreatureBrain.State s) => motion = s;

        public void LookAt(Vector3 worldPoint)
        {
            Vector3 d = worldPoint - transform.position; d.y = 0;
            if (d.sqrMagnitude > 1e-4f) faceDir = Quaternion.LookRotation(d);
        }

        public void Bounce(float strength) { bounce = Mathf.Max(bounce, strength * 0.25f); }

        public void Flinch(Vector3 fromDirection)
        {
            fromDirection.y = 0;
            if (fromDirection.sqrMagnitude > 1e-4f) faceDir = Quaternion.LookRotation(-fromDirection);
            bounce = 0.1f;
        }

        void Update()
        {
            float dt = Time.deltaTime; t += dt;
            bool walking = motion == CreatureBrain.State.Wander || motion == CreatureBrain.State.Approach || motion == CreatureBrain.State.Follow;
            bool napping = motion == CreatureBrain.State.Nap;

            transform.rotation = Quaternion.Slerp(transform.rotation, faceDir, dt * turnSpeed);

            // bob + waddle
            float freq = walking ? 9f : 2f;
            float bob = Mathf.Sin(t * freq) * (walking ? bobAmount * 2f : bobAmount);
            float waddle = walking ? Mathf.Sin(t * freq) * waddleAmount : 0f;
            visual.localPosition = new Vector3(0, bob + (napping ? -0.01f : 0f), 0);
            visual.localRotation = Quaternion.Euler(napping ? 12f : 0f, 0, waddle);

            // bounce spring (squash and stretch)
            bounce = Mathf.Lerp(bounce, 0f, dt * 6f);
            float s = Mathf.Sin(t * 18f) * bounce;
            visual.localScale = new Vector3(baseScale.x * (1 + s), baseScale.y * (1 - s), baseScale.z * (1 + s));

            if (feet != null)
                for (int i = 0; i < feet.Length; i++)
                    if (feet[i] != null) feet[i].localRotation = Quaternion.Euler(walking ? Mathf.Sin(t * freq + i * Mathf.PI) * 25f : 0, 0, 0);

            // blink
            if (eyes != null)
            {
                blinkTimer -= dt;
                float ey = napping ? 0.08f : (blinkTimer < 0.1f ? 0.1f : 1f);
                eyes.localScale = new Vector3(1, ey, 1);
                if (blinkTimer < 0) blinkTimer = Random.Range(2f, 5f);
            }

            if (lightPool != null)
            {
                lightPool.position = new Vector3(transform.position.x, lightPool.position.y, transform.position.z);
                float pulse = 1f + Mathf.Sin(t * 1.5f) * 0.03f;
                lightPool.localScale = Vector3.one * pulse * (napping ? 0.8f : 1f);
            }
        }
    }
}
