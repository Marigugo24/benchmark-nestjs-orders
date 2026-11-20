# Resultados - NestJS (Node.js)

## Consumo del sistema

| Escenario | CPU API (%) | RAM API (MiB) | CPU DB (%) | RAM DB (MiB) | Observaciones |
|---|---|---|---|---|---|
| Baja carga (10) | 110% | 94 MiB | 103% | 75 MiB | Estable, sin errores |
| Media carga (50) | 109% | 87 MiB | 85% | 174 MiB | Sin errores; throughput ya plano |
| Alta carga (100) | 112% | 101 MiB | 83% | 202 MiB | Sin errores; máximos aislados de ~1 s |
| Estrés (300) | 145% | 108 MiB | 122% | 270 MiB | Sin errores; latencia 3 veces mayor que en el punto de saturación |

El CPU está medido por núcleo (100% equivale a un núcleo completo).

## Comparación del desempeño por stack y escenario

### Baja carga (10 usuarios)

| Stack | Avg (ms) | P95 (ms) | Throughput (req/s) | % Error |
|---|---|---|---|---|
| NestJS (Node) | 4.32 | 8 | 2200.9 | 0% |

### Media carga (50 usuarios)

| Stack | Avg (ms) | P95 (ms) | Throughput (req/s) | % Error |
|---|---|---|---|---|
| NestJS (Node) | 20.19 | 36 | 2269.1 | 0% |

### Alta carga (100 usuarios)

| Stack | Avg (ms) | P95 (ms) | Throughput (req/s) | % Error |
|---|---|---|---|---|
| NestJS (Node) | 34.95 | 60 | 2387.6 | 0% |

### Estrés (300 usuarios)

| Stack | Avg (ms) | P95 (ms) | Throughput (req/s) | % Error |
|---|---|---|---|---|
| NestJS (Node) | 126 | 191 | 1971.9 | 0% |
