using System.Collections;
using UnityEngine;

namespace AliveThings.Creature
{
    /// <summary>
    /// A speech bubble with no words. It shows icons built from the creature's own paint
    /// patterns, so a cup painted with scallops "talks" in scallops. Attach to a creature,
    /// give it a world-space canvas or a sprite quad as the bubble, and pattern sprites.
    /// </summary>
    public class WhisperBubble : MonoBehaviour
    {
        public Transform bubble;                   // enabled while whispering, faces the player
        public SpriteRenderer[] slots = new SpriteRenderer[2];
        public Sprite[] patternSprites;            // index matches Paint.ZenBrush.Pattern
        public AudioSource voice;                  // short syllables, pitched by personality
        public AudioClip[] syllables;
        public Transform lookTarget;               // the player's head

        CreatureBrain brain;
        Paint.PaintSurface paint;
        Coroutine running;

        void Awake()
        {
            brain = GetComponent<CreatureBrain>();
            paint = GetComponentInChildren<Paint.PaintSurface>();
            if (bubble != null) bubble.gameObject.SetActive(false);
        }

        void Update()
        {
            bool whispering = brain != null && brain.state == CreatureBrain.State.Whisper;
            if (whispering && running == null) running = StartCoroutine(Whisper());
            if (bubble != null && bubble.gameObject.activeSelf && lookTarget != null)
                bubble.rotation = Quaternion.LookRotation(bubble.position - lookTarget.position);
        }

        IEnumerator Whisper()
        {
            if (bubble != null) bubble.gameObject.SetActive(true);
            int said = 0;
            while (brain.state == CreatureBrain.State.Whisper && said < 3)
            {
                for (int i = 0; i < slots.Length; i++)
                    if (slots[i] != null && patternSprites != null && patternSprites.Length > 0)
                        slots[i].sprite = patternSprites[PickPattern()];
                Chirp();
                said++;
                yield return new WaitForSeconds(Random.Range(0.9f, 1.4f));
            }
            if (bubble != null) bubble.gameObject.SetActive(false);
            running = null;
        }

        /// <summary>Weighted by what the player actually painted on this creature.</summary>
        int PickPattern()
        {
            if (paint == null || paint.patternCounts == null || paint.patternCounts.Length == 0)
                return Random.Range(0, patternSprites.Length);
            int total = 0; foreach (var c in paint.patternCounts) total += c;
            if (total == 0) return Random.Range(0, patternSprites.Length);
            int r = Random.Range(0, total);
            for (int i = 0; i < paint.patternCounts.Length; i++) { r -= paint.patternCounts[i]; if (r < 0) return Mathf.Min(i, patternSprites.Length - 1); }
            return 0;
        }

        /// <summary>Animalese-style: a random syllable, pitch set by traits. No recorded lines needed.</summary>
        void Chirp()
        {
            if (voice == null || syllables == null || syllables.Length == 0) return;
            var t = brain.traits;
            voice.pitch = Mathf.Lerp(0.8f, 1.6f, t.playful) * (t.sleepy > 0.6f ? 0.85f : 1f);
            voice.PlayOneShot(syllables[Random.Range(0, syllables.Length)], 0.5f);
        }
    }
}
