using System.Collections.Generic;
using UnityEngine;

namespace AliveThings.Creature
{
    /// <summary>
    /// Needs-based "free will". Four needs rise over time at rates set by traits.
    /// The highest need picks the current behavior. No pathfinding: creatures live on
    /// a flat, open floor (My Space) and steer with simple vectors.
    /// </summary>
    [RequireComponent(typeof(CreatureBody))]
    public class CreatureBrain : MonoBehaviour
    {
        public enum State { Idle, Wander, Approach, Whisper, Nap, Follow, Flinch, Peek }

        public CreatureTraits traits = CreatureTraits.Neutral;
        public State state = State.Idle;

        [Header("Needs (0..1)")]
        public float needExplore;
        public float needRest;
        public float needCompany;
        public float needPlay;

        [Header("Tuning")]
        public float walkSpeed = 0.25f;
        public float arenaRadius = 2.5f;
        public float meetDistance = 0.45f;
        public Transform player;             // head transform; set by MySpace

        // shared registry so creatures can find each other cheaply
        public static readonly List<CreatureBrain> All = new List<CreatureBrain>();
        readonly Dictionary<CreatureBrain, float> affinity = new Dictionary<CreatureBrain, float>();

        CreatureBody body;
        Vector3 target;
        float stateTimer;
        CreatureBrain partner;

        void OnEnable() { All.Add(this); body = GetComponent<CreatureBody>(); PickWanderTarget(); }
        void OnDisable() { All.Remove(this); }

        void Update()
        {
            float dt = Time.deltaTime;
            // needs rise; traits set the rates
            needExplore = Mathf.Clamp01(needExplore + dt * 0.02f * (0.5f + traits.curious));
            needRest = Mathf.Clamp01(needRest + dt * 0.015f * (0.3f + traits.sleepy));
            needCompany = Mathf.Clamp01(needCompany + dt * 0.02f * (0.3f + traits.social));
            needPlay = Mathf.Clamp01(needPlay + dt * 0.018f * (0.2f + traits.playful));

            stateTimer -= dt;
            if (stateTimer <= 0f) Decide();
            Act(dt);
        }

        void Decide()
        {
            // committed states finish on their own timers
            partner = null;
            float top = Mathf.Max(needExplore, needRest, needCompany, needPlay);
            if (top < 0.35f) { Enter(State.Idle, Random.Range(2f, 5f)); return; }

            if (top == needRest) { Enter(State.Nap, Random.Range(8f, 16f)); needRest = 0; return; }
            if (top == needCompany)
            {
                partner = Nearest(excludeSelf: true);
                if (partner != null) { Enter(State.Approach, 8f); return; }
            }
            if (top == needPlay && player != null && traits.curious > 0.4f) { Enter(State.Follow, Random.Range(4f, 8f)); needPlay *= 0.5f; return; }
            PickWanderTarget(); Enter(State.Wander, Random.Range(3f, 7f)); needExplore *= 0.4f;
        }

        void Act(float dt)
        {
            switch (state)
            {
                case State.Wander:
                    if (MoveToward(target, walkSpeed * (1f - 0.5f * traits.sleepy), dt)) stateTimer = 0f;
                    break;
                case State.Approach:
                    if (partner == null) { stateTimer = 0; break; }
                    if (MoveToward(partner.transform.position, walkSpeed, dt, meetDistance))
                    {
                        Enter(State.Whisper, Random.Range(3f, 5f));
                        partner.InviteWhisper(this);
                        Bond(partner, +0.2f);
                        needCompany = 0;
                    }
                    break;
                case State.Follow:
                    if (player != null) MoveToward(FlatPos(player.position), walkSpeed * 1.2f, dt, 0.8f);
                    break;
                case State.Whisper:
                    if (partner != null) body.LookAt(partner.transform.position);
                    break;
                case State.Nap:
                case State.Idle:
                case State.Flinch:
                case State.Peek:
                    break;
            }
            body.SetMotion(state);
        }

        public void InviteWhisper(CreatureBrain from)
        {
            partner = from;
            Enter(State.Whisper, Random.Range(3f, 5f));
            Bond(from, +0.2f);
            needCompany = 0;
        }

        /// <summary>Called by the poke system. Reaction depends on personality.</summary>
        public void OnPoked(Vector3 fromDirection)
        {
            if (traits.shy > 0.5f) { Enter(State.Flinch, 1.2f); body.Flinch(fromDirection); }
            else { Enter(State.Idle, 0.8f); body.Bounce(0.5f + traits.playful); needPlay = 0; }
        }

        public float AffinityWith(CreatureBrain other) => affinity.TryGetValue(other, out var a) ? a : 0f;

        void Bond(CreatureBrain other, float delta)
        {
            affinity[other] = Mathf.Clamp01(AffinityWith(other) + delta);
            // close friends start following each other when idle
            if (affinity[other] > 0.6f && Random.value < 0.3f) { target = FlatPos(other.transform.position); }
        }

        void Enter(State s, float seconds) { state = s; stateTimer = seconds; }

        bool MoveToward(Vector3 to, float speed, float dt, float stopAt = 0.05f)
        {
            to = FlatPos(to);
            Vector3 d = to - FlatPos(transform.position);
            if (d.magnitude <= stopAt) return true;
            transform.position += d.normalized * speed * dt;
            body.LookAt(to);
            return false;
        }

        void PickWanderTarget()
        {
            Vector2 r = Random.insideUnitCircle * arenaRadius;
            target = new Vector3(r.x, transform.position.y, r.y);
        }

        CreatureBrain Nearest(bool excludeSelf)
        {
            CreatureBrain best = null; float bestD = float.MaxValue;
            foreach (var c in All)
            {
                if (excludeSelf && c == this) continue;
                float d = (c.transform.position - transform.position).sqrMagnitude;
                // prefer friends a little
                d *= 1f - 0.5f * AffinityWith(c);
                if (d < bestD) { bestD = d; best = c; }
            }
            return best;
        }

        Vector3 FlatPos(Vector3 p) => new Vector3(p.x, transform.position.y, p.z);
    }
}
