-- Check if KOPERATIVE KOZAMGI has been collecting milk for the past 5 days
-- This script queries milk_sales table for KOPERATIVE KOZAMGI account

-- First, let's find the KOPERATIVE KOZAMGI account
SELECT 
    id,
    code,
    name,
    status
FROM accounts 
WHERE name ILIKE '%KOPERATIVE KOZAMGI%' 
   OR code = 'A_16C846';

-- Check milk sales for KOPERATIVE KOZAMGI in the past 5 days
-- KOPERATIVE KOZAMGI can be either a supplier (selling milk) or customer (buying milk)

-- As SUPPLIER (selling milk)
SELECT 
    'KOPERATIVE KOZAMGI as SUPPLIER' as role,
    DATE(sale_at) as sale_date,
    COUNT(*) as number_of_sales,
    SUM(quantity) as total_quantity_liters,
    SUM(quantity * unit_price) as total_amount,
    status
FROM milk_sales
WHERE supplier_account_id = (
    SELECT id FROM accounts WHERE code = 'A_16C846' LIMIT 1
)
AND sale_at >= CURRENT_DATE - INTERVAL '5 days'
GROUP BY DATE(sale_at), status
ORDER BY sale_date DESC;

-- As CUSTOMER (buying/collecting milk)
SELECT 
    'KOPERATIVE KOZAMGI as CUSTOMER' as role,
    DATE(sale_at) as sale_date,
    COUNT(*) as number_of_collections,
    SUM(quantity) as total_quantity_liters,
    SUM(quantity * unit_price) as total_amount,
    status
FROM milk_sales
WHERE customer_account_id = (
    SELECT id FROM accounts WHERE code = 'A_16C846' LIMIT 1
)
AND sale_at >= CURRENT_DATE - INTERVAL '5 days'
GROUP BY DATE(sale_at), status
ORDER BY sale_date DESC;

-- Summary: Check which days had activity in the past 5 days
WITH date_series AS (
    SELECT generate_series(
        CURRENT_DATE - INTERVAL '4 days',
        CURRENT_DATE,
        INTERVAL '1 day'
    )::date as check_date
),
kozamgi_account AS (
    SELECT id FROM accounts WHERE code = 'A_16C846' LIMIT 1
)
SELECT 
    ds.check_date,
    COALESCE(COUNT(ms.id), 0) as total_transactions,
    COALESCE(SUM(CASE WHEN ms.supplier_account_id = ka.id THEN 1 ELSE 0 END), 0) as as_supplier,
    COALESCE(SUM(CASE WHEN ms.customer_account_id = ka.id THEN 1 ELSE 0 END), 0) as as_customer,
    COALESCE(SUM(ms.quantity), 0) as total_quantity_liters,
    CASE 
        WHEN COUNT(ms.id) > 0 THEN '✓ Active'
        ELSE '✗ No Activity'
    END as status
FROM date_series ds
CROSS JOIN kozamgi_account ka
LEFT JOIN milk_sales ms ON 
    DATE(ms.sale_at) = ds.check_date
    AND (ms.supplier_account_id = ka.id OR ms.customer_account_id = ka.id)
    AND ms.status != 'deleted'
GROUP BY ds.check_date
ORDER BY ds.check_date DESC;
