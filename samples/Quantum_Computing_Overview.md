# Quantum Computing & Cryptographic Implications

## Device Source: MacBook Pro (Research Workspace)
Indexed research document investigating quantum hardware topologies, qubit coherence, and post-quantum cryptographic standards.

### Core Principles
1. **Superposition**: A quantum state $|\psi\rangle = \alpha|0\rangle + \beta|1\rangle$ where $|\alpha|^2 + |\beta|^2 = 1$.
2. **Entanglement**: Non-separable multi-qubit states such as Bell state $|\Phi^+\rangle = \frac{1}{\sqrt{2}}(|00\rangle + |11\rangle)$.
3. **Quantum Gates**: Unitary operators representing quantum logic (Hadamard, Pauli-X, CNOT, Toffoli).

### Threat to Modern Public-Key Cryptography
* **Shor's Algorithm**: Solves prime factorization in polynomial time $O((\log N)^3)$, rendering RSA-2048 and Elliptic Curve Cryptography (ECC) vulnerable upon the advent of fault-tolerant cryptanalytically relevant quantum computers (CRQCs).
* **Grover's Algorithm**: Quadratic speedup for unstructured search $O(\sqrt{N})$, necessitating transition to AES-256 for symmetric encryption.
* **NIST PQC Standards**: Lattice-based algorithms including ML-KEM (Kyber) and ML-DSA (Dilithium) recommended for defense-in-depth security.
