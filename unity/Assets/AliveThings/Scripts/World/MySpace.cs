using System.Collections.Generic;
using UnityEngine;

namespace AliveThings.World
{
    /// <summary>
    /// The dark garden where creatures live. Owns the light pools, the plant guide,
    /// and the gentle milestone prompts ("it looks a bit lonely", the three-creature party).
    /// </summary>
    public class MySpace : MonoBehaviour
    {
        public Transform floor;               // flat disc, radius = arena
        public GameObject lightPoolPrefab;    // warm radial disc, additive
        public Transform plantGuide;          // hangs top-right, smiles, speaks in bubbles
        public Transform playerHead;
        public float arenaRadius = 2.5f;

        readonly List<Creature.CreatureBrain> residents = new List<Creature.CreatureBrain>();
        bool partyDone;

        /// <summary>Called when the player sets a creature down in My Space.</summary>
        public void Place(Creature.CreatureBrain creature, Vector3 where)
        {
            where.y = floor != null ? floor.position.y : 0f;
            creature.transform.position = where;
            creature.player = playerHead;
            creature.arenaRadius = arenaRadius;

            var body = creature.GetComponent<Creature.CreatureBody>();
            if (lightPoolPrefab != null && body != null && body.lightPool == null)
            {
                var pool = Instantiate(lightPoolPrefab, where + Vector3.up * 0.002f, Quaternion.Euler(90, 0, 0), transform);
                pool.transform.localScale = Vector3.zero;
                StartCoroutine(Grow(pool.transform, 1.2f));
                body.lightPool = pool.transform;
            }

            residents.Add(creature);
            OnResidentsChanged();
        }

        void OnResidentsChanged()
        {
            if (residents.Count == 1) Say("it looks a little lonely out here.");
            if (residents.Count == 3 && !partyDone) { partyDone = true; Party(); }
        }

        void Party()
        {
            // everyone bounces once, lights pulse, plant beams. Enough reward for playing.
            foreach (var c in residents) { var b = c.GetComponent<Creature.CreatureBody>(); if (b != null) b.Bounce(1f); }
            Say("you brought friends!");
        }

        void Say(string line)
        {
            // Hook up a WhisperBubble-like component on the plant; for now log so the beat is visible in the editor.
            Debug.Log("[plant] " + line);
        }

        System.Collections.IEnumerator Grow(Transform t, float seconds)
        {
            float k = 0; while (k < 1f) { k += Time.deltaTime / seconds; float s = Mathf.SmoothStep(0, 1, k); t.localScale = Vector3.one * s; yield return null; }
        }
    }
}
