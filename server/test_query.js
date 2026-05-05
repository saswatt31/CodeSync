require("dotenv").config();
const { supabase } = require("./services/supabase");

async function test() {
  const reqUser = { id: 'some-uuid' }; // Mock user id
  const { data, error } = await supabase
    .from("sessions")
    .select("*, participants(count)")
    .or(`host_id.eq.${reqUser.id},participants.user_id.eq.${reqUser.id}`)
    .order("created_at", { ascending: false });

  console.log("Error:", error);
}

test();
