const assert = require('assert');
const app = require('./index');

async function testBackend() {
  console.log('Testing Express Backend Endpoints...');

  const server = app.listen(0, async () => {
    const port = server.address().port;
    const baseUrl = `http://localhost:${port}`;

    try {
      // Test cargos
      let res = await fetch(`${baseUrl}/api/cargos`);
      let json = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(json.success, true);
      assert(json.data.length > 0);
      console.log('✓ GET /api/cargos passed');

      // Test transports
      res = await fetch(`${baseUrl}/api/transports`);
      json = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(json.success, true);
      assert(json.data.length > 0);
      console.log('✓ GET /api/transports passed');

      // Test route calc
      res = await fetch(`${baseUrl}/api/route-calc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromCity: 'Москва', toCity: 'Санкт-Петербург', truckWeightTons: 20 })
      });
      json = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(json.distanceKm, 710);
      assert(json.freightCalculation.recommendedShipperRate > 0);
      console.log('✓ POST /api/route-calc passed');

      // Test loading norms
      res = await fetch(`${baseUrl}/api/loading-norms/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productType: 'pipe', shellDiameter: '160', stakeHeight: '2.0', pipeCount: 300 })
      });
      json = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(json.normPerTruck, 156);
      assert.strictEqual(json.requiredTrucks, 2);
      console.log('✓ POST /api/loading-norms/calculate passed');

      // Test counterparties
      res = await fetch(`${baseUrl}/api/counterparties?query=7701234567`);
      json = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(json.data[0].name, 'ООО "Логистик Групп"');
      console.log('✓ GET /api/counterparties passed');

      // Test orders
      res = await fetch(`${baseUrl}/api/orders`);
      json = await res.json();
      assert.strictEqual(res.status, 200);
      assert(json.data.length > 0);
      console.log('✓ GET /api/orders passed');

      console.log('ALL BACKEND TESTS PASSED SUCCESSFULLY!');
    } catch (err) {
      console.error('Backend Test Error:', err);
      process.exitCode = 1;
    } finally {
      server.close();
    }
  });
}

testBackend();
