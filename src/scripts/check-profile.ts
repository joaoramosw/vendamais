import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProfile() {
  console.log("Checking profiles table schema/data...");
  const { data, error } = await supabase
    .from("profiles")
    .select("nome, tipo, empresa, global_role")
    .limit(1);

  if (error) {
    console.error("Query Error:", error);
  } else {
    console.log("Query Success. First row:", data);
  }
}

checkProfile();
