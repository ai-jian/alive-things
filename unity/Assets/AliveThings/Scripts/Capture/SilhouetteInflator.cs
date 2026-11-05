using System.Collections.Generic;
using UnityEngine;

namespace AliveThings.Capture
{
    /// <summary>
    /// Turns a 2D silhouette (a binary mask from the camera photo) into a puffy 3D mesh.
    /// Simplified "Teddy" inflation:
    ///   1. sample the mask on a grid,
    ///   2. distance-to-edge for each inside cell (chamfer distance transform),
    ///   3. height = sqrt(distance) scaled → round cross-section,
    ///   4. front and back sheets, stitched at the rim,
    ///   5. UVs are the photo's pixel coordinates, so the photo projects straight on.
    /// Not precise. Soft and toy-like on purpose.
    /// </summary>
    public static class SilhouetteInflator
    {
        /// <param name="mask">true = object pixel. Row-major, width*height.</param>
        /// <param name="worldWidth">real width of the object in metres (from pinch depth and mask pixel width).</param>
        /// <param name="thickness">how fat the object is relative to its width (0.5 is a plush cup).</param>
        /// <param name="grid">mesh resolution along the longer side.</param>
        public static Mesh Inflate(bool[] mask, int width, int height, float worldWidth, float thickness = 0.5f, int grid = 48)
        {
            float cell = Mathf.Max(width, height) / (float)grid;
            int gw = Mathf.CeilToInt(width / cell), gh = Mathf.CeilToInt(height / cell);
            bool[,] inside = new bool[gw, gh];
            for (int y = 0; y < gh; y++) for (int x = 0; x < gw; x++)
            {
                int px = Mathf.Min(width - 1, (int)((x + .5f) * cell)), py = Mathf.Min(height - 1, (int)((y + .5f) * cell));
                inside[x, y] = mask[py * width + px];
            }

            float[,] dist = DistanceToEdge(inside, gw, gh);
            float maxDist = 0; foreach (var d in dist) maxDist = Mathf.Max(maxDist, d);
            if (maxDist <= 0) return null;

            float scale = worldWidth / width;                 // metres per pixel
            float maxHeight = worldWidth * thickness * 0.5f;   // half thickness in metres

            var verts = new List<Vector3>(); var uvs = new List<Vector2>(); var tris = new List<int>();
            int[,] front = new int[gw, gh], back = new int[gw, gh];

            for (int y = 0; y < gh; y++) for (int x = 0; x < gw; x++)
            {
                front[x, y] = back[x, y] = -1;
                if (!inside[x, y]) continue;
                float h = Mathf.Sqrt(dist[x, y] / maxDist) * maxHeight;   // sqrt gives a round, not pointy, profile
                float wx = (x + .5f) * cell * scale - worldWidth * .5f;
                float wy = (gh - y - .5f) * cell * scale;                   // image y is down; mesh y is up
                Vector2 uv = new Vector2((x + .5f) / gw, 1f - (y + .5f) / gh);
                front[x, y] = verts.Count; verts.Add(new Vector3(wx, wy, -h)); uvs.Add(uv);
                back[x, y] = verts.Count; verts.Add(new Vector3(wx, wy, h)); uvs.Add(uv);
            }

            // faces for each 2x2 block where all four are inside
            for (int y = 0; y < gh - 1; y++) for (int x = 0; x < gw - 1; x++)
            {
                if (!(inside[x, y] && inside[x + 1, y] && inside[x, y + 1] && inside[x + 1, y + 1])) continue;
                int a = front[x, y], b = front[x + 1, y], c = front[x, y + 1], d = front[x + 1, y + 1];
                tris.AddRange(new[] { a, c, b, b, c, d });               // front (facing -z toward the player)
                a = back[x, y]; b = back[x + 1, y]; c = back[x, y + 1]; d = back[x + 1, y + 1];
                tris.AddRange(new[] { a, b, c, b, d, c });               // back, reversed winding
            }

            // rim: where an inside cell borders an outside cell, connect front and back
            for (int y = 0; y < gh; y++) for (int x = 0; x < gw; x++)
            {
                if (!inside[x, y]) continue;
                if (x + 1 < gw && inside[x + 1, y]) Stitch(x, y, x + 1, y, inside, front, back, gw, gh, tris);
                if (y + 1 < gh && inside[x, y + 1]) Stitch(x, y, x, y + 1, inside, front, back, gw, gh, tris);
            }

            var mesh = new Mesh { name = "InflatedSilhouette" };
            mesh.SetVertices(verts); mesh.SetUVs(0, uvs); mesh.SetTriangles(tris, 0);
            mesh.RecalculateNormals(); mesh.RecalculateBounds();
            return mesh;
        }

        // connects an edge between two inside cells to the other sheet if the edge is on the boundary
        static void Stitch(int x0, int y0, int x1, int y1, bool[,] inside, int[,] front, int[,] back, int gw, int gh, List<int> tris)
        {
            bool horizontal = y0 == y1;
            bool boundary;
            if (horizontal) boundary = !In(x0, y0 - 1, inside, gw, gh) || !In(x0, y0 + 1, inside, gw, gh) || !In(x1, y1 - 1, inside, gw, gh) || !In(x1, y1 + 1, inside, gw, gh);
            else boundary = !In(x0 - 1, y0, inside, gw, gh) || !In(x0 + 1, y0, inside, gw, gh) || !In(x1 - 1, y1, inside, gw, gh) || !In(x1 + 1, y1, inside, gw, gh);
            if (!boundary) return;
            int f0 = front[x0, y0], f1 = front[x1, y1], b0 = back[x0, y0], b1 = back[x1, y1];
            tris.AddRange(new[] { f0, f1, b0, f1, b1, b0, f0, b0, f1, f1, b0, b1 }); // both windings; cheap and never see-through
        }

        static bool In(int x, int y, bool[,] inside, int gw, int gh) => x >= 0 && y >= 0 && x < gw && y < gh && inside[x, y];

        /// <summary>Two-pass chamfer distance transform (3-4 weights). Outside cells are 0.</summary>
        static float[,] DistanceToEdge(bool[,] inside, int gw, int gh)
        {
            float big = gw + gh; var d = new float[gw, gh];
            for (int y = 0; y < gh; y++) for (int x = 0; x < gw; x++) d[x, y] = inside[x, y] ? big : 0;
            for (int y = 0; y < gh; y++) for (int x = 0; x < gw; x++) { if (!inside[x, y]) continue;
                d[x, y] = Mathf.Min(d[x, y], G(d, x - 1, y, gw, gh) + 3, G(d, x, y - 1, gw, gh) + 3, G(d, x - 1, y - 1, gw, gh) + 4, G(d, x + 1, y - 1, gw, gh) + 4); }
            for (int y = gh - 1; y >= 0; y--) for (int x = gw - 1; x >= 0; x--) { if (!inside[x, y]) continue;
                d[x, y] = Mathf.Min(d[x, y], G(d, x + 1, y, gw, gh) + 3, G(d, x, y + 1, gw, gh) + 3, G(d, x + 1, y + 1, gw, gh) + 4, G(d, x - 1, y + 1, gw, gh) + 4); }
            return d;
        }
        static float G(float[,] d, int x, int y, int gw, int gh) => (x < 0 || y < 0 || x >= gw || y >= gh) ? 0 : d[x, y];
    }
}
