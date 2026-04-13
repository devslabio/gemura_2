-- Check historical milk collection data for KOPERATIVE KOZAMGI

-- Get the account info
SELECT 
    id,
    code,
    name,
    status,
    created_at
FROM accounts 
WHERE code = 'A_16C846';

-- Check most recent milk sales (as supplier or customer)
SELECT 
    DATE(sale_at) as sale_date,
    CASE 
        WHEN supplier_account_id = (SELECT id FROM accounts WHERE code = 'A_16C846') THEN 'SUPPLIER'
        WHEN customer_account_id = (SELECT id FROM accounts WHERE code = 'A_16C846') THEN 'CUSTOMER'
    END as role,
    COUNT(*) as transactions,
    SUM(quantity) as total_liters,
    status
FROM milk_sales
WHERE (
    supplier_account_id = (SELECT id FROM accounts WHERE code = 'A_16C846')
    OR customer_account_id = (SELECT id FROM accounts WHERE code = 'A_16C846')
)
AND sale_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(sale_at), role, status
ORDER BY sale_date DESC
LIMIT 20;

-- Check last 10 transactions
SELECT 
    sale_at,
    CASE 
        WHEN supplier_account_id = (SELECT id FROM accounts WHERE code = 'A_16C846') THEN 'SUPPLIER'
        WHEN customer_account_id = (SELECT id FROM accounts WHERE code = 'A_16C846') THEN 'CUSTOMER'
    END as role,
    quantity,
    unit_price,
    status,
    created_at
FROM milk_sales
WHERE (
    supplier_account_id = (SELECT id FROM accounts WHERE code = 'A_16C846')
    OR customer_account_id = (SELECT id FROM accounts WHERE code = 'A_16C846')
)
ORDER BY sale_at DESC
LIMIT 10;

-- Total statistics
SELECT 
    COUNT(*) as total_transactions,
    MIN(sale_at) as first_transaction,
    MAX(sale_at) as last_transaction,
    SUM(quantity) as total_liters_all_time
FROM milk_sales
WHERE (
    supplier_account_id = (SELECT id FROM accounts WHERE code = 'A_16C846')
    OR customer_account_id = (SELECT id FROM accounts WHERE code = 'A_16C846')
)
AND status != 'deleted';
