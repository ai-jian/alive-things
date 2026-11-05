using UnityEngine;

namespace AliveThings.Interaction
{
    /// <summary>
    /// The only place that knows about the headset's hand tracking API.
    /// Everything else reads this. Implement the abstract getters with
    /// Meta's OVRHand / OVRSkeleton (or any other provider) in a subclass.
    ///
    /// Default implementation below uses mouse for editor testing so the
    /// rest of the project runs without a headset.
    /// </summary>
    public abstract class HandInput : MonoBehaviour
    {
        public static HandInput Instance { get; private set; }

        public struct Hand
        {
            public bool tracked;
            public Vector3 indexTip, thumbTip, palm;
            public Vector3 palmNormal;     // points out of the palm
            public float pinchStrength;    // 0..1
            public bool IsPinching => pinchStrength > 0.7f;
            public bool IsOpenPalm => pinchStrength < 0.15f;
            public Vector3 PinchPoint => (indexTip + thumbTip) * 0.5f;
        }

        public abstract Hand Left { get; }
        public abstract Hand Right { get; }
        public abstract Transform Head { get; }

        protected virtual void Awake() { Instance = this; }
    }

    /// <summary>Editor stand-in: right hand follows the mouse on a plane in front of the camera.</summary>
    public class MouseHandInput : HandInput
    {
        public float depth = 0.5f;
        Hand right;
        public override Hand Left => default;
        public override Hand Right => right;
        public override Transform Head => Camera.main != null ? Camera.main.transform : transform;

        void Update()
        {
            var cam = Camera.main; if (cam == null) return;
            Vector3 p = cam.ScreenToWorldPoint(new Vector3(Input.mousePosition.x, Input.mousePosition.y, depth));
            right.tracked = true;
            right.indexTip = p; right.thumbTip = p + cam.transform.right * 0.02f; right.palm = p - cam.transform.forward * 0.08f;
            right.palmNormal = cam.transform.forward;
            right.pinchStrength = Input.GetMouseButton(0) ? 1f : 0f;
        }
    }
}
