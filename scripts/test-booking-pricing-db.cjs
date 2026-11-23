// Run with @electric-sql/pglite available on NODE_PATH (isolated test dependency).
const { PGlite } = require('@electric-sql/pglite')
const assert = require('node:assert/strict')
const fs = require('node:fs')
async function main() {
  const db = new PGlite()
  try {
    await db.exec(`
      create table booking_service_types (id integer primary key, name text, active boolean default true);
      create table booking_service_packages (id integer primary key, service_type_id integer, name text, price bigint, active boolean default true);
      create table booking_payment_settings (id text primary key, deposit_percent integer);
      create table booking_requests (id integer primary key, service_type_id integer, package_id integer,
        full_name text, phone text, zalo text, event_date date, location text, service text, service_name text,
        package_name text, package_price bigint, service_price bigint, payment_option text, payment_requested boolean,
        payment_method text, payment_percent integer, payment_amount bigint, status text, transferred boolean, transferred_at timestamptz);
    `)
    await db.exec(fs.readFileSync('supabase/migrations/20261123100000_booking_people_pricing.sql','utf8'))
    await db.exec(`
      create trigger booking_snapshot_trigger before insert on booking_requests for each row execute function set_booking_snapshot();
      insert into booking_service_types values (1, 'Nhóm', true, true, '[{"min":1,"max":2,"price":300000},{"min":3,"max":4,"price":250000},{"min":5,"max":null,"price":200000}]');
      insert into booking_service_types (id, name) values (2, 'Cố định');
      insert into booking_service_packages values (1,1,'Gói A',999), (2,2,'Gói B',700001);
      insert into booking_payment_settings values ('main',30);
    `)
    const insert = (id, count, option='deposit', service=1, pkg=1) => db.query(`insert into booking_requests
      (id,service_type_id,package_id,full_name,phone,event_date,location,people_count,unit_price,package_price,payment_amount,payment_option)
      values ($1,$2,$3,'Khách','0901234567','2026-12-01','Studio',$4,1,1,1,$5) returning *`, [id,service,pkg,count,option])
    for (const [count, unit] of [[1,300000],[2,300000],[3,250000],[4,250000],[5,200000],[100,200000]]) {
      const {rows:[row]} = await insert(count,count)
      assert.equal(Number(row.package_price),count*unit)
      assert.equal(Number(row.service_price),count*unit)
      assert.equal(Number(row.unit_price),unit)
      assert.equal(Number(row.payment_amount), Math.ceil(count*unit*.3))
    }
    const {rows:[full]} = await insert(101,3,'full')
    assert.equal(Number(full.payment_amount),750000)
    const {rows:[later]} = await insert(102,3,'later')
    assert.equal(Number(later.payment_amount),0)
    const {rows:[fixed]} = await insert(103,10,'deposit',2,2)
    assert.equal(Number(fixed.package_price),700001)
    assert.equal(Number(fixed.payment_amount),210001)
    assert.equal(fixed.people_count,null)
    assert.equal(fixed.unit_price,null)
    await assert.rejects(insert(104,null),/số người/)
    await assert.rejects(insert(105,0),/số người/)
    await assert.rejects(insert(106,2,'full',1,2),/không hợp lệ/)
    for (const tiers of [[],[{min:1,max:2,price:3},{min:2,max:4,price:5}],[{min:1,max:2,price:0}],[{min:1,max:2.5,price:10}],[{min:1,max:null,price:10},{min:5,max:6,price:10}]]) {
      await assert.rejects(db.query('update booking_service_types set people_price_tiers=$1 where id=1',[JSON.stringify(tiers)]),/booking_people_tiers_valid/)
    }
    await db.exec(`update booking_service_types set people_price_tiers='[{"min":1,"max":2,"price":400000}]' where id=1`)
    await assert.rejects(insert(107,3),/chưa có trong bảng giá/)
    const {rows:[old]} = await db.query('select * from booking_requests where id=3')
    assert.equal(Number(old.package_price),750000)
    await db.exec('update booking_requests set status=\'confirmed\' where id=3')
    const {rows:[updated]} = await db.query('select * from booking_requests where id=3')
    assert.equal(Number(updated.package_price),750000)
    console.log('PASS: migration, boundaries, deposits, full/later payment, fixed-price compatibility, tamper protection, invalid ranges, uncovered counts and historical snapshots')
  } finally { await db.close() }
}
main().catch(error => { console.error(error); process.exitCode=1 })
