-- Tags on triaged documents. Stored as JSON so the column stays normalized
-- on engines without a native array type (MariaDB returns it as a string,
-- the backend JSON-decodes before mapping to the API shape).

ALTER TABLE admin_docs ADD COLUMN tags JSON DEFAULT NULL;
