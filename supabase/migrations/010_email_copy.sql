-- Jeremy's subject lines and the 15-minute email leading with the one-tap link (2026-09-20).
update events set reminder_rules = '[
  {"key": "before30", "minutes_before": 30, "subject": "Starting soon: your {{start_local}} join link inside", "body": "Hi {{first_name}},\n\nWe start in 30 minutes. Your private link:\n{{join_url}}\n\nOpen it a few minutes early, on a laptop if you can, and turn the sound on when it starts.\n\nSee you there,\n{{host_name}}"},
  {"key": "before15", "minutes_before": 15, "subject": "Join now: room opens in 15 min (one-tap link)", "body": "{{join_url}}\n\nThis is your one-tap link to join on your phone. Tap it, then tap for sound.\n\n{{host_name}}"}
]'::jsonb;
