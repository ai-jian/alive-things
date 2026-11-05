using System.Collections;
using UnityEngine;
using UnityEngine.Audio;

namespace AliveThings.World
{
    /// <summary>
    /// "The room fades." Hook Enter() to HoldAndOpenGesture.onOpen and Exit() to onClose.
    /// Dims passthrough to a warm dark fog, ducks all audio except the hum,
    /// and lights only the held object with one spotlight.
    /// Passthrough tinting is done through a layer/material you control (OVRPassthroughLayer
    /// edge/colour controls, or a full-screen quad over passthrough). This script drives a 0..1 value.
    /// </summary>
    public class FocusMode : MonoBehaviour
    {
        public static FocusMode Instance { get; private set; }

        [Header("Targets")]
        public Light focusSpot;                  // follows the held object
        public Transform heldObject;
        public AudioMixer mixer;                 // exposed params: "WorldVolume", "HumVolume"
        public Material passthroughFog;          // has _Fog (0..1) and _Tint

        [Header("Feel")]
        public float fadeSeconds = 1.6f;
        public Color fogTint = new Color(0.16f, 0.13f, 0.19f);
        public AnimationCurve ease = AnimationCurve.EaseInOut(0, 0, 1, 1);

        public bool IsFocused { get; private set; }
        public float Amount { get; private set; }   // 0 room, 1 focus
        Coroutine fade;

        static readonly int Fog = Shader.PropertyToID("_Fog");
        static readonly int Tint = Shader.PropertyToID("_Tint");

        void Awake() { Instance = this; Apply(0); }

        public void Enter(Transform held)
        {
            heldObject = held; IsFocused = true;
            if (fade != null) StopCoroutine(fade);
            fade = StartCoroutine(FadeTo(1f));
        }

        public void Exit()
        {
            IsFocused = false;
            if (fade != null) StopCoroutine(fade);
            fade = StartCoroutine(FadeTo(0f));
        }

        IEnumerator FadeTo(float to)
        {
            float from = Amount, t = 0;
            while (t < 1f)
            {
                t += Time.deltaTime / fadeSeconds;
                Apply(Mathf.Lerp(from, to, ease.Evaluate(Mathf.Clamp01(t))));
                yield return null;
            }
            Apply(to);
        }

        void Apply(float a)
        {
            Amount = a;
            if (passthroughFog != null) { passthroughFog.SetFloat(Fog, a); passthroughFog.SetColor(Tint, fogTint); }
            if (mixer != null)
            {
                mixer.SetFloat("WorldVolume", Mathf.Lerp(0f, -18f, a));
                mixer.SetFloat("HumVolume", Mathf.Lerp(-80f, -8f, a));
            }
            if (focusSpot != null) focusSpot.intensity = Mathf.Lerp(0f, 4f, a);
        }

        void LateUpdate()
        {
            if (focusSpot != null && heldObject != null)
            {
                focusSpot.transform.position = heldObject.position + Vector3.up * 0.6f;
                focusSpot.transform.LookAt(heldObject);
            }
        }
    }
}
