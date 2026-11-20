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

## Conclusiones individuales - NestJS (Node.js)

- **Latencia y throughput:** el promedio sube de 4.32 ms con 10 usuarios a 126 ms con 300, y el P95 de 8 a 191 ms. El throughput se mantiene entre 2200 y 2750 req/s y llega a su máximo (2746 req/s) con unos 160 usuarios.
- **Estabilidad:** no hubo errores en ninguno de los niveles, hasta 300 usuarios. La degradación fue gradual: la API se encola, pero no falla.
- **Posibles causas de la saturación:** Node ejecuta el código en un solo hilo, por lo que la API usó entre 109 % y 145 % de CPU (poco más de un núcleo) incluso con carga baja. Además, el pool de 20 conexiones a PostgreSQL hace cola cuando hay más usuarios. La base de datos también llegó a 103-122 % de CPU, así que el cuello de botella parece repartido entre la API y Postgres. No se midió cuál pesa más.
- **Limitación del entorno:** JMeter, la API y la base de datos corrieron en el mismo equipo de 8 GB con el swap casi lleno, y entre corridas del mismo nivel hubo una variación de alrededor del 20 %.
- **Pendiente para el grupo:** comparar estos resultados con Flask, Spring Boot y Go o Rust para responder qué stack tuvo mejor latencia y throughput, cuál fue más estable, y cuál recomendar para producción.
