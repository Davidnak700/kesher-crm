-- =============================================================================
-- Demo data generator
--
--   select public.seed_demo_data('<user uuid>');
--
-- Wipes that user's companies / contacts / deals / tasks / activities and
-- fills the account with ~6 months of realistic, mixed Hebrew + English data
-- (good for showing RTL and LTR text side by side). Deterministic: the same
-- call always produces the same data. Not callable from the app — only by the
-- database owner (SQL editor / seed script / a scheduled reset).
-- =============================================================================

create or replace function public.seed_demo_data(p_owner uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  company_names text[] := array[
    'אלפא מערכות', 'Blue Harbor Studio', 'נגב סולאר', 'Cedar Logistics',
    'מאפיית השוק', 'Northwind Apps', 'כרמל נדל"ן', 'Pixel & Co',
    'גלבוע תיירות', 'Brightpath Education', 'יעלים קפה', 'Orion Fitness'
  ];
  industries text[] := array[
    'Software', 'Design', 'Energy', 'Logistics', 'Food', 'Software',
    'Real estate', 'Marketing', 'Tourism', 'Education', 'Food', 'Fitness'
  ];
  first_he text[] := array['נועה','יוסי','מיכל','אבי','שירה','דניאל','תמר','איתי','רוני','עומר'];
  last_he  text[] := array['כהן','לוי','מזרחי','פרץ','ביטון','אברהם','פרידמן','שפירא','גולן','אזולאי'];
  first_en text[] := array['Emma','Liam','Olivia','Noah','Ava','Ethan','Mia','Lucas','Sophia','Mason'];
  last_en  text[] := array['Smith','Johnson','Brown','Miller','Davis','Wilson','Taylor','Clark','Lewis','Walker'];
  positions_ text[] := array['CEO','Marketing Manager','מנהלת תפעול','Founder','סמנכ"ל כספים','Office Manager','Head of Sales','בעלים'];
  sources public.contact_source[] := array['website','referral','social','ads','event','cold','other']::public.contact_source[];
  deal_templates text[] := array[
    'אתר תדמית חדש', 'Website redesign', 'קמפיין ממומן', 'Annual support plan',
    'חנות אונליין', 'Mobile app MVP', 'ייעוץ שיווקי', 'SEO package',
    'מיתוג ולוגו', 'CRM integration', 'דף נחיתה', 'Analytics dashboard'
  ];
  task_titles text[] := array[
    'להתקשר ולתאם פגישה', 'Send proposal', 'לשלוח הצעת מחיר מעודכנת', 'Follow up on invoice',
    'Prepare demo', 'לבדוק משוב על הסקיצות', 'Renewal call', 'לשלוח חוזה לחתימה'
  ];
  activity_bodies text[] := array[
    'שיחה ראשונה — מתעניינים בחבילה המלאה',
    'Intro call, budget confirmed',
    'נשלחה הצעת מחיר במייל',
    'Meeting at their office, met the team',
    'ביקשו הנחה של 10%',
    'Sent case studies and references',
    'אישרו את לוח הזמנים',
    'Asked for a revised scope'
  ];

  open_stages uuid[];   -- lead, qualified, proposal, negotiation (by position)
  won_stage   uuid;
  lost_stage  uuid;

  company_ids uuid[] := '{}';
  contact_ids uuid[] := '{}';
  contact_company uuid[] := '{}';
  deal_ids uuid[] := '{}';

  v_id         uuid;
  v_company    uuid;
  v_contact    uuid;
  v_created    timestamptz;
  v_t          timestamptz;
  v_steps      int;
  v_outcome    text;
  v_final      uuid;
  v_closed     timestamptz;
  v_idx        int;
  i            int;
  k            int;
begin
  perform setseed(0.42);

  -- reset this user's data (stage history cascades with deals)
  delete from activities where owner_id = p_owner;
  delete from tasks      where owner_id = p_owner;
  delete from deals      where owner_id = p_owner;
  delete from contacts   where owner_id = p_owner;
  delete from companies  where owner_id = p_owner;

  select array_agg(id order by position) into open_stages
    from pipeline_stages where owner_id = p_owner and kind = 'open';
  select id into won_stage  from pipeline_stages where owner_id = p_owner and kind = 'won'  order by position limit 1;
  select id into lost_stage from pipeline_stages where owner_id = p_owner and kind = 'lost' order by position limit 1;

  if coalesce(array_length(open_stages, 1), 0) = 0 or won_stage is null or lost_stage is null then
    raise exception 'User % has no pipeline stages', p_owner;
  end if;

  -- companies --------------------------------------------------------------
  for i in 1 .. array_length(company_names, 1) loop
    v_created := now() - make_interval(days => 150 + (random() * 40)::int);
    insert into companies (owner_id, name, industry, website, phone, created_at, updated_at)
    values (
      p_owner, company_names[i], industries[i],
      'https://example.com/' || i,
      '05' || (2 + (random() * 7)::int) || '-' || lpad((random() * 9999999)::int::text, 7, '0'),
      v_created, v_created
    )
    returning id into v_id;
    company_ids := company_ids || v_id;
  end loop;

  -- contacts (half Hebrew, half English names) -----------------------------
  for i in 1 .. 40 loop
    v_company := case when random() < 0.8 then company_ids[1 + (random() * (array_length(company_ids, 1) - 1))::int] end;
    v_created := now() - make_interval(days => (random() * 175)::int, hours => (random() * 23)::int);
    insert into contacts (owner_id, company_id, first_name, last_name, email, phone, position, status, source, tags, created_at, updated_at)
    values (
      p_owner,
      v_company,
      case when i % 2 = 0 then first_he[1 + (random() * 9)::int] else first_en[1 + (random() * 9)::int] end,
      case when i % 2 = 0 then last_he[1 + (random() * 9)::int]  else last_en[1 + (random() * 9)::int]  end,
      'contact' || i || '@example.com',
      '05' || (2 + (random() * 7)::int) || '-' || lpad((random() * 9999999)::int::text, 7, '0'),
      positions_[1 + (random() * 7)::int],
      (array['lead','lead','customer','customer','customer','inactive']::public.contact_status[])[1 + (random() * 5)::int],
      sources[1 + (random() * 6)::int],
      case when random() < 0.3 then array['vip'] when random() < 0.3 then array['newsletter'] else '{}' end,
      v_created, v_created
    )
    returning id into v_id;
    contact_ids := contact_ids || v_id;
    contact_company := contact_company || v_company;
  end loop;

  -- deals with a realistic stage path --------------------------------------
  for i in 1 .. 48 loop
    v_idx     := 1 + (random() * (array_length(contact_ids, 1) - 1))::int;
    v_contact := contact_ids[v_idx];
    v_company := contact_company[v_idx];
    v_created := now() - make_interval(days => 3 + (random() * 175)::int);

    -- older deals are more likely to be closed
    if v_created < now() - interval '45 days' and random() < 0.75 then
      v_outcome := case when random() < 0.55 then 'won' else 'lost' end;
    else
      v_outcome := 'open';
    end if;

    v_steps := 1 + (random() * (array_length(open_stages, 1) - 1))::int;  -- furthest open stage reached
    if v_outcome = 'won' then
      v_steps := greatest(v_steps, array_length(open_stages, 1) - 1);
    end if;

    v_final := case v_outcome
                 when 'won'  then won_stage
                 when 'lost' then lost_stage
                 else open_stages[v_steps]
               end;

    v_closed := case when v_outcome <> 'open'
                     then least(now() - interval '1 day', v_created + make_interval(days => 10 + (random() * 40)::int))
                end;

    insert into deals (owner_id, title, amount, stage_id, contact_id, company_id, position,
                       expected_close_date, closed_at, created_at, updated_at)
    values (
      p_owner,
      deal_templates[1 + (random() * (array_length(deal_templates, 1) - 1))::int]
        || coalesce(' — ' || (select name from companies where id = v_company), ''),
      round((2000 + random() * 78000) / 500) * 500,
      v_final, v_contact, v_company, i * 1000,
      (v_created + make_interval(days => 20 + (random() * 60)::int))::date,
      v_closed, v_created, coalesce(v_closed, v_created)
    )
    returning id into v_id;
    deal_ids := deal_ids || v_id;

    -- replace the auto-logged single history row with a back-dated path
    delete from deal_stage_history where deal_id = v_id;
    v_t := v_created;
    for k in 1 .. v_steps loop
      insert into deal_stage_history (owner_id, deal_id, from_stage_id, to_stage_id, changed_at)
      values (p_owner, v_id, case when k > 1 then open_stages[k - 1] end, open_stages[k], v_t);
      v_t := v_t + make_interval(days => 1 + (random() * 6)::int);
    end loop;
    if v_outcome <> 'open' then
      insert into deal_stage_history (owner_id, deal_id, from_stage_id, to_stage_id, changed_at)
      values (p_owner, v_id, open_stages[v_steps], v_final, v_closed);
    end if;
  end loop;

  -- tasks: some overdue, some upcoming, some done ---------------------------
  for i in 1 .. 24 loop
    v_t := now() + make_interval(days => -10 + (random() * 24)::int, hours => (random() * 8)::int);
    insert into tasks (owner_id, title, priority, due_at, completed_at, deal_id, contact_id)
    values (
      p_owner,
      task_titles[1 + (random() * (array_length(task_titles, 1) - 1))::int],
      (array['low','medium','medium','high']::public.task_priority[])[1 + (random() * 3)::int],
      v_t,
      case when v_t < now() and random() < 0.6 then v_t - interval '2 hours' end,
      case when i % 3 <> 0 then deal_ids[1 + (random() * (array_length(deal_ids, 1) - 1))::int] end,
      case when i % 3 = 0  then contact_ids[1 + (random() * (array_length(contact_ids, 1) - 1))::int] end
    );
  end loop;

  -- activities on deals ----------------------------------------------------
  for i in 1 .. array_length(deal_ids, 1) loop
    for k in 1 .. 1 + (random() * 2)::int loop
      select created_at into v_created from deals where id = deal_ids[i];
      insert into activities (owner_id, type, body, deal_id, contact_id, occurred_at, created_at)
      select
        p_owner,
        (array['note','call','email','meeting']::public.activity_type[])[1 + (random() * 3)::int],
        activity_bodies[1 + (random() * (array_length(activity_bodies, 1) - 1))::int],
        d.id, d.contact_id,
        least(now(), v_created + make_interval(days => k * (1 + (random() * 5)::int))),
        now()
      from deals d where d.id = deal_ids[i];
    end loop;
  end loop;
end;
$$;

revoke all on function public.seed_demo_data(uuid) from public, anon, authenticated;
