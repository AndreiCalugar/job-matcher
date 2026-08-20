-- Prompt-cache writes are billed separately (1.25x) and do not appear in
-- input_tokens. Without this column the meter under-reports every call
-- that creates a cache entry.
alter table usage_event add column cache_creation_tokens int not null default 0;
