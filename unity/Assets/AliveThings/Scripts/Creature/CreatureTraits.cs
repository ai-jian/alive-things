using UnityEngine;

namespace AliveThings.Creature
{
    /// <summary>
    /// A creature's personality. Each value is 0..1.
    /// Traits are derived from how the player painted it (see StrokeStats),
    /// never random, so the creature feels "grown" from the player's flow.
    /// </summary>
    [System.Serializable]
    public struct CreatureTraits
    {
        [Range(0, 1)] public float curious;   // approaches new things, looks at the player
        [Range(0, 1)] public float sleepy;    // naps often, slow walker
        [Range(0, 1)] public float social;    // seeks other creatures, whispers more
        [Range(0, 1)] public float playful;   // bounces, reacts big to pokes
        [Range(0, 1)] public float shy;       // hides behind others, flinches when poked

        public static CreatureTraits Neutral => new CreatureTraits { curious = .5f, sleepy = .3f, social = .5f, playful = .4f, shy = .2f };

        /// <summary>
        /// Map paint statistics to traits. Slow, dotted, repetitive strokes read as quiet.
        /// Fast loops and spirals read as playful. Coverage reads as social (they "have more to say").
        /// </summary>
        public static CreatureTraits FromStrokes(StrokeStats s)
        {
            float slow = 1f - Mathf.Clamp01(s.averageSpeed / 0.6f); // 0.6 m/s is "fast" for a fingertip
            return new CreatureTraits
            {
                curious = Mathf.Clamp01(0.3f + 0.7f * s.patternVariety),
                sleepy = Mathf.Clamp01(0.2f + 0.6f * slow + 0.2f * s.dotRatio),
                social = Mathf.Clamp01(0.2f + 0.8f * s.coverage),
                playful = Mathf.Clamp01(0.1f + 0.6f * s.loopRatio + 0.3f * (1f - slow)),
                shy = Mathf.Clamp01(0.6f * s.dotRatio * slow),
            };
        }

        /// <summary>Two short words for the tag shown when the creature wakes.</summary>
        public string Describe()
        {
            string a = sleepy > .6f ? "quiet" : playful > .6f ? "bouncy" : social > .6f ? "chatty" : "calm";
            string b = curious > .6f ? "curious" : shy > .5f ? "shy" : social > .5f ? "friendly" : "dreamy";
            return a + " · " + b;
        }
    }

    /// <summary>What the paint system records while the player draws. Filled by ZenBrush.</summary>
    [System.Serializable]
    public struct StrokeStats
    {
        public float averageSpeed;    // m/s of the fingertip while painting
        public float coverage;        // 0..1 fraction of the surface touched
        public float dotRatio;        // fraction of units that were dots
        public float loopRatio;       // fraction of units that were loops or spirals
        public float patternVariety;  // 0..1, how many of the six patterns were used
        public int unitCount;         // total pattern units placed
    }
}
