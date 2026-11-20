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

> **Ojo con los niveles de carga.** El PDF es inconsistente: la sección 5 pide 20 / 70 / 150
> usuarios y la sección 6 (resultados y tabla grupal) pide 10 / 50 / 100 + estrés de 20 en 20.
> Aquí se usa 10 / 50 / 100 porque es lo que va en la tabla de entrega. Confírmalo con el
> profesor o con tu grupo, y que los 4 usen los mismos niveles para que la comparación valga.

Sin ningún Timer en el plan, cada usuario dispara requests sin pausa, así que 100 usuarios
es carga muy agresiva. Si el grupo acuerda pausa entre requests, añadan un Constant Timer
igual para los 4 stacks.

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

Ten en cuenta que `docker stats` reporta CPU por núcleo (200 % = 2 núcleos al tope).
Si el grupo compara CPU, aclaren si es por núcleo o normalizado.

## 5. Plantilla de resultados (tu fila: NestJS)

| Escenario | Avg (ms) | P95 (ms) | Throughput (req/s) | % Error |
|---|---|---|---|---|
| Baja (10) | | | | |
| Media (50) | | | | |
| Alta (100) | | | | |
| Estrés (__ usuarios) | | | | |

| Escenario | CPU API (%) | RAM API (MiB) | CPU DB (%) | RAM DB (MiB) | Observaciones |
|---|---|---|---|---|---|
| Baja (10) | | | | | |
| Media (50) | | | | | |
| Alta (100) | | | | | |
| Estrés | | | | | |

### Evidencias a adjuntar
- Captura Summary Report y Aggregate Report (por escenario)
- Captura de JMeter durante la carga
- `docker ps`
- `docker stats` y `htop` durante cada prueba

## 6. Decisiones de implementación (útiles para las conclusiones del grupo)

- **Pool de `pg`** con `max = 20` (`DB_POOL_MAX`). Con 100 usuarios concurrentes, las requests
  excedentes hacen cola esperando conexión. Es un candidato clásico a cuello de botella;
  puedes repetir una prueba con `DB_POOL_MAX=50` para comparar.
- **Transacción** (`BEGIN`/`COMMIT`) que inserta la orden y todos los items; un solo `INSERT`
  multi-fila para `order_items`.
- **Sin ORM**: SQL directo, para medir el stack y no el ORM. Si el profesor espera TypeORM,
  el resultado sería más lento.
- **Node es single-thread**: una sola instancia usa ~1 núcleo, así que su CPU suele toparse
  en ~100 % antes que la BD. Útil para explicar la diferencia con Go/Rust/Spring Boot.
- `ValidationPipe` (class-validator) valida cada request; tiene un costo real y forma parte
  de lo que un NestJS típico hace en producción.
- Logging por request desactivado, ya que distorsiona la medición.

## 7. Limpieza entre pruebas

Para que cada escenario parta en igualdad de condiciones:

```bash
docker exec db-orders psql -U postgres -d orders_db -c "TRUNCATE orders, order_items RESTART IDENTITY;"
```

Apagar todo: `docker compose down` (con `-v` borra también los datos).
