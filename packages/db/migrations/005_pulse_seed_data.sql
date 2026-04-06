-- Insert sample events to populate Pulse UI
INSERT INTO public.pulse_events (title, summary, category, source, severity, affected_instruments, published_at, source_url, dedup_hash) VALUES
('Fed Signals Potential Rate Pause in June Meeting', 'Federal Reserve officials indicated they may hold rates steady at the upcoming June meeting, citing cooling inflation data.', 'fed', 'Reuters', 'high', '["ES", "NQ", "TLT", "DXY"]', NOW() - INTERVAL '2 hours', 'https://reuters.com', 'hash1'),

('Trump Threatens Military Action in Strait of Hormuz', 'Former President Trump posted warning Iran over shipping lane disruptions. Oil traders reacted with volatility spike.', 'geopolitical', 'Truth Social', 'critical', '["CL", "ES", "DXY", "XLE"]', NOW() - INTERVAL '4 hours', 'https://truthsocial.com', 'hash2'),

('NASDAQ Proposes Fast-Track IPO Rules for AI Companies', 'NASDAQ filed rule change allowing OpenAI and Anthropic to list with 15-day notice.', 'sector', 'Yahoo Finance', 'high', '["NQ", "XLK", "ES"]', NOW() - INTERVAL '6 hours', 'https://finance.yahoo.com', 'hash3'),

('CPI Comes in Hot: Core Inflation Rises 0.4% Monthly', 'April core CPI rose more than expected. Treasury yields spiked.', 'macro', 'Investing.com', 'critical', '["TLT", "ES", "NQ", "DXY", "VIX"]', NOW() - INTERVAL '8 hours', 'https://investing.com', 'hash4'),

('Apple Beats Earnings, Guides Lower on China Sales', 'AAPL reported strong Q2 but warned on China. Stock volatile after-hours.', 'earnings', 'Reuters', 'high', '["ES", "NQ", "XLK"]', NOW() - INTERVAL '12 hours', 'https://reuters.com', 'hash5'),

('Gold Breaks $2,400 on Safe-Haven Demand', 'Spot gold reached all-time highs on geopolitical tensions.', 'commodities', 'Investing.com', 'medium', '["GC", "SI", "DXY"]', NOW() - INTERVAL '1 day', 'https://investing.com', 'hash6');
