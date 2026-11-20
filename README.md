# Benchmark Node.js + NestJS — `POST /api/orders`

Stack: NestJS 10 (Express) + `pg` (pool, sin ORM) + PostgreSQL 16, todo en Docker.

## 1. Levantar el entorno

```bash
docker compose up -d --build
docker ps                      # evidencia: api-orders y db-orders corriendo
```

Las tablas `orders` y `order_items` se crean solas con `db/init.sql`.
La API queda en `http://localhost:5001/api/orders` y Postgres en `localhost:5433`.

Prueba rápida:

```bash
curl -X POST http://localhost:5001/api/orders \
  -H "Content-Type: application/json" \
  -d '{"customerId":"C123","items":[{"productId":"P1","quantity":2,"price":10.5},{"productId":"P2","quantity":1,"price":5.0}]}'
```

Respuesta (201):

```json
{"orderId":"ORD-...","customerId":"C123","totalAmount":26,"itemsCount":3,"processedAt":"2026-..."}
```

`itemsCount` = suma de cantidades (2 + 1 = 3). `totalAmount` = Σ price × quantity.

Verificar en BD:

```bash
docker exec -it db-orders psql -U postgres -d orders_db -c "SELECT count(*) FROM orders;"
```

## 2. Pruebas con JMeter

El plan `jmeter/orders.jmx` ya trae Thread Group, HTTP Request Defaults,
HTTP Header Manager, HTTP Request (POST con el JSON), una aserción de status 201,
y los listeners **Summary Report** y **Aggregate Report**.
El número de usuarios se controla con propiedades, así no hay que editar el plan.

**Con GUI** (para las capturas): abre `jmeter/orders.jmx`, o lanza
`jmeter -t jmeter/orders.jmx -Jthreads=50 -Jduration=60`, y pulsa Start.

**Sin GUI** (recomendado para medir, la GUI consume CPU y distorsiona):

```bash
mkdir -p jmeter/results
jmeter -n -t jmeter/orders.jmx -Jthreads=10  -Jramp=5  -Jduration=60 -l jmeter/results/baja.jtl  -e -o jmeter/results/baja-html
jmeter -n -t jmeter/orders.jmx -Jthreads=50  -Jramp=10 -Jduration=60 -l jmeter/results/media.jtl -e -o jmeter/results/media-html
jmeter -n -t jmeter/orders.jmx -Jthreads=100 -Jramp=20 -Jduration=60 -l jmeter/results/alta.jtl  -e -o jmeter/results/alta-html
```

Escenario de estrés (de 20 en 20 hasta notar degradación):

```bash
for u in 20 40 60 80 100 120 140 160; do
  jmeter -n -t jmeter/orders.jmx -Jthreads=$u -Jramp=20 -Jduration=60 -l jmeter/results/estres-$u.jtl
done
```

El punto de estrés es el primer nivel donde el % de error deja de ser 0, el P95 se dispara
o el throughput deja de crecer o cae.

## 3. Qué guardar por escenario

Del **Aggregate Report** / **Summary Report**:

| Métrica | Dónde |
|---|---|
| Average Response Time (ms) | Aggregate: *Average* |
| P95 (ms) | Aggregate: *95% Line* |
| Throughput (req/s) | Aggregate: *Throughput* |
| % Error | Aggregate: *Error %* |

## 4. Monitoreo de recursos (CPU/RAM de API y BD)

Durante cada prueba, en otra terminal:

```bash
docker stats api-orders db-orders          # CPU % y MEM USAGE de ambos contenedores
htop                                       # procesos del host (captura durante la carga)
```

Anota el **pico** de CPU y RAM de cada contenedor mientras corre la prueba (no el valor de reposo).
Para guardar el historial: `docker stats --no-stream api-orders db-orders >> jmeter/results/stats-<escenario>.txt`
en un bucle, o simplemente toma captura en el momento de mayor carga.


## 5. Decisiones de implementación

- **Pool de `pg`** con `max = 20` (`DB_POOL_MAX`). Con 100 usuarios concurrentes, las requests
  excedentes hacen cola esperando conexión. Es un candidato clásico a cuello de botella;
- **Transacción** (`BEGIN`/`COMMIT`) que inserta la orden y todos los items; un solo `INSERT`
  multi-fila para `order_items`.
- **Sin ORM**: SQL directo, para medir el stack y no el ORM.
- **Node es single-thread**: una sola instancia usa ~1 núcleo, así que su CPU suele toparse
  en ~100 % antes que la BD.
- `ValidationPipe` (class-validator) valida cada request; tiene un costo real y forma parte
  de lo que un NestJS típico hace en producción.
- Logging por request desactivado, ya que distorsiona la medición.

## 6. Limpieza entre pruebas

Para que cada escenario parta en igualdad de condiciones:

```bash
docker exec db-orders psql -U postgres -d orders_db -c "TRUNCATE orders, order_items RESTART IDENTITY;"
```

Apagar todo: `docker compose down` (con `-v` borra también los datos).

## 7. Resultados

Entorno: MacBook Air con 8 GB de RAM. La API, PostgreSQL y JMeter corrieron en la misma máquina. Cada escenario duró 60 segundos, con pool de 20 conexiones a la base de datos.

### Rendimiento

| Escenario | Avg (ms) | P95 (ms) | Throughput (req/s) | % Error |
|---|---|---|---|---|
| Baja (10) | 4.32 | 8 | 2200.9 | 0 % |
| Media (50) | 20.19 | 36 | 2269.1 | 0 % |
| Alta (100) | 34.95 | 60 | 2387.6 | 0 % |
| Estrés (300) | 126 | 191 | 1971.9 | 0 % |

### Consumo de recursos

| Escenario | CPU API | RAM API | CPU DB | RAM DB | Observaciones |
|---|---|---|---|---|---|
| Baja (10) | 110 % | 94 MiB | 103 % | 75 MiB | Estable, sin errores |
| Media (50) | 109 % | 87 MiB | 85 % | 174 MiB | Sin errores; throughput ya plano |
| Alta (100) | 112 % | 101 MiB | 83 % | 202 MiB | Sin errores; máximos aislados de ~1 s |
| Estrés (300) | 145 % | 108 MiB | 122 % | 270 MiB | Sin errores; latencia 3 veces mayor que en el punto de saturación |

El CPU está medido por núcleo (100 % equivale a un núcleo completo).

### Observaciones

- El punto de saturación está en unos 160 usuarios, donde el throughput llega a su máximo (2746 req/s). Después solo sube la latencia.
- No hubo errores en ningún nivel, hasta 300 usuarios. NestJS se degrada por encolamiento, no por fallos.
- Node usa un solo hilo, por eso la API se acerca a un núcleo desde la carga baja y más usuarios no aumentan el throughput.
- Entre corridas del mismo nivel hay variación de alrededor del 20 %, porque JMeter, la API y la base de datos comparten la CPU de un equipo con 8 GB y el swap casi lleno.
