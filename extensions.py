from supabase import Client, create_client

from config import Config

Config.validate()

supabase: Client = create_client(
    Config.SUPABASE_URL,
    Config.SUPABASE_SERVICE_ROLE_KEY,
)
