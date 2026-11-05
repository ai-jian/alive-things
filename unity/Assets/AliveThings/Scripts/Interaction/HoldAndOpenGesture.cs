using UnityEngine;
using UnityEngine.Events;

namespace AliveThings.Interaction
{
    /// <summary>
    /// "Hold it in one hand, pull with the other" → enter Focus Mode.
    /// One hand is pinching on a holdable object. The other hand pinches near it
    /// and moves away more than openDistance. Releasing the holding hand exits.
    /// </summary>
    public class HoldAndOpenGesture : MonoBehaviour
    {
        public float grabRadius = 0.08f;      // how close a pinch must be to count as holding this
        public float openDistance = 0.15f;    // pull this far to open
        public UnityEvent onOpen;
        public UnityEvent onClose;

        public bool IsHeld { get; private set; }
        public bool IsOpen { get; private set; }
        public bool HeldByLeft { get; private set; }

        Vector3 openStart;
        bool openArmed;

        void Update()
        {
            var input = HandInput.Instance; if (input == null) return;
            var L = input.Left; var R = input.Right;

            if (!IsHeld)
            {
                if (L.tracked && L.IsPinching && Near(L.PinchPoint)) { IsHeld = true; HeldByLeft = true; }
                else if (R.tracked && R.IsPinching && Near(R.PinchPoint)) { IsHeld = true; HeldByLeft = false; }
                return;
            }

            var holder = HeldByLeft ? L : R;
            var other = HeldByLeft ? R : L;

            if (!holder.IsPinching) { Release(); return; }

            // follow the holding hand
            transform.position = Vector3.Lerp(transform.position, holder.PinchPoint, Time.deltaTime * 20f);

            if (IsOpen) return;

            if (other.tracked && other.IsPinching)
            {
                if (!openArmed && Near(other.PinchPoint, grabRadius * 1.5f)) { openArmed = true; openStart = other.PinchPoint; }
                else if (openArmed && Vector3.Distance(openStart, other.PinchPoint) > openDistance) { IsOpen = true; onOpen?.Invoke(); }
            }
            else openArmed = false;
        }

        void Release()
        {
            bool wasOpen = IsOpen;
            IsHeld = false; IsOpen = false; openArmed = false;
            if (wasOpen) onClose?.Invoke();
        }

        bool Near(Vector3 p, float r = -1f) => Vector3.Distance(p, transform.position) <= (r < 0 ? grabRadius : r);
    }
}
