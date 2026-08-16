import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { join } from 'path'

dotenv.config({ path: join(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkAndRestore() {
  console.log('--- Checking Users ---')
  const { data: users, error: usersErr } = await supabase.auth.admin.listUsers()
  if (usersErr) {
    console.error('Error fetching users:', usersErr)
    return
  }
  
  console.log(`Found ${users.users.length} users.`)
  for (const user of users.users.slice(0, 5)) {
    console.log(`- ${user.email} (ID: ${user.id})`)
  }

  console.log('\n--- Checking Profiles ---')
  const { data: profiles, error: profErr } = await supabase.from('profiles').select('*').limit(5)
  if (profErr) {
    console.error('Error fetching profiles:', profErr)
  } else {
    console.log(`Found ${profiles.length} profiles.`)
    for (const p of profiles) {
      console.log(`- ${p.email} | Tipo: ${p.tipo} | ID: ${p.id}`)
    }
  }
}

checkAndRestore()
