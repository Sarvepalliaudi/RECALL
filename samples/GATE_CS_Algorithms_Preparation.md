# GATE Computer Science & Information Technology Preparation Notes

## Week 1 Focus: Data Structures and Advanced Algorithms
Downloaded for comprehensive GATE exam revision covering core mathematical foundations, asymptotic analysis, and graph theory.

### 1. Asymptotic Complexity and Recurrence Relations
* Master Theorem formula: $T(n) = aT(n/b) + \Theta(n^k \log^p n)$
* Case 1: If $\log_b a > k$, then $T(n) = \Theta(n^{\log_b a})$
* Case 2: If $\log_b a = k$:
  * If $p > -1$, $T(n) = \Theta(n^k \log^{p+1} n)$
  * If $p = -1$, $T(n) = \Theta(n^k \log \log n)$
  * If $p < -1$, $T(n) = \Theta(n^k)$
* Case 3: If $\log_b a < k$:
  * If $p \ge 0$, $T(n) = \Theta(n^k \log^p n)$

### 2. Graph Algorithms & Shortest Path Complexities
* **Dijkstra's Algorithm**: Single source shortest path on non-negative edge weights. Time complexity: $O((V + E) \log V)$ using Fibonacci heap.
* **Bellman-Ford Algorithm**: Handles negative weight edges, detects negative cycles. Time complexity: $O(V \cdot E)$.
* **Floyd-Warshall**: All-pairs shortest path dynamic programming algorithm. Time complexity: $O(V^3)$.
* **Prim's & Kruskal's MST**: Minimum Spanning Tree algorithms. Kruskal uses Disjoint Set Union (DSU) in $O(E \log E)$ time.

### 3. GATE Practice Problem Log
* Dynamic Programming: 0/1 Knapsack vs Fractional Knapsack (Greedy vs DP trade-off).
* Longest Common Subsequence (LCS) recurrence: $L[i,j] = 1 + L[i-1,j-1]$ if $X[i] == Y[j]$, else $\max(L[i-1,j], L[i,j-1])$.
* Binary Search Trees: AVL rotation balancing rules (LL, RR, LR, RL) and B-Tree node split criteria.
