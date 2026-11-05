using System.Collections;
using UnityEngine;

namespace AliveThings.Creature
{
    /// <summary>
    /// A speech bubble with no words. It shows little marks in the creature's own palette and manner:
    /// a dotty creature whispers in dots, a swirly one in curls, a slow one in long soft strokes.
    /// Attach to a creature, give it a sprite quad as the bubble and three mark sprites.
    /// </summary>
    public class WhisperBubble : MonoBehaviour
    {
        public Transform bubble;                   // enabled while whispering, faces the player
        public SpriteRenderer[] slots = new SpriteRenderer[2];
        public Sprite dotSprite, strokeSprite, curlSprite;
        public AudioSource voice;                  // short syllables, pitched by personality
        public AudioClip[] syllables;
        public Transform lookTarget;               // the player's head

        CreatureBrain brain;
        Paint.ZenBrush brush;
        Paint.PaletteFromObject palette;
        Coroutine running;

        void Awake()
        {
            brain = GetComponent<CreatureBrain>();
            brush = GetComponentInChildren<Paint.ZenBrush>();
            palette = GetComponentInChildren<Paint.PaletteFromObject>();
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
            Color tint = palette != null ? Paint.PaletteFromObject.Build(palette.dominant, palette.hueDriftDeep, palette.hueDriftLight)[3] : Color.white;
            int said = 0;
            while (brain.state == CreatureBrain.State.Whisper && said < 3)
            {
                foreach (var s in slots) if (s != null) { s.sprite = PickMark(); s.color = tint; }
                Chirp();
                said++;
                yield return new WaitForSeconds(Random.Range(0.9f, 1.4f));
            }
            if (bubble != null) bubble.gameObject.SetActive(false);
            running = null;
        }

        /// <summary>Weighted by how the player actually drew on this creature.</summary>
        Sprite PickMark()
        {
            var st = brush != null ? brush.stats : default;
            float dot = 0.2f + st.dotRatio, curl = 0.2f + st.turnRatio, line = 0.2f + (1f - st.turnRatio) * 0.5f;
            float r = Random.value * (dot + curl + line);
            return r < dot ? dotSprite : r < dot + curl ? curlSprite : strokeSprite;
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
