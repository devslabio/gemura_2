-- Find all accounts with "kozamgi" in the name or code

-- Search for all Kozamgi-related accounts
SELECT 
    id,
    code,
    name,
    type,
    status,
    created_at,
    updated_at
FROM accounts 
WHERE name ILIKE '%kozamgi%' 
   OR code ILIKE '%kozamgi%'
ORDER BY status, name;

-- Count total accounts
SELECT 
    COUNT(*) as total_kozamgi_accounts,
    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_accounts,
    COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive_accounts
FROM accounts 
WHERE name ILIKE '%kozamgi%' 
   OR code ILIKE '%kozamgi%';

-- Check milk sales activity for each Kozamgi account in the past 30 days
SELECT 
    a.code,
    a.name,
    a.status as account_status,
    COUNT(ms.id) as transactions_last_30_days,
    MAX(ms.sale_at) as last_transaction_date,
    SUM(ms.quantity) as total_liters_last_30_days
FROM accounts a
LEFT JOIN milk_sales ms ON (
    (ms.supplier_account_id = a.id OR ms.customer_account_id = a.id)
    AND ms.sale_at >= CURRENT_DATE - INTERVAL '30 days'
    AND ms.status != 'deleted'
)
WHERE a.name ILIKE '%kozamgi%' 
   OR a.code ILIKE '%kozamgi%'
GROUP BY a.id, a.code, a.name, a.status
ORDER BY a.status, a.name;

-- Check all-time activity for each Kozamgi account
SELECT 
    a.code,
    a.name,
    a.status as account_status,
    COUNT(ms.id) as total_transactions,
    MIN(ms.sale_at) as first_transaction,
    MAX(ms.sale_at) as last_transaction,
    SUM(ms.quantity) as total_liters_all_time
FROM accounts a
LEFT JOIN milk_sales ms ON (
    (ms.supplier_account_id = a.id OR ms.customer_account_id = a.id)
    AND ms.status != 'deleted'
)
WHERE a.name ILIKE '%kozamgi%' 
   OR a.code ILIKE '%kozamgi%'
GROUP BY a.id, a.code, a.name, a.status
ORDER BY a.status, total_transactions DESC;
