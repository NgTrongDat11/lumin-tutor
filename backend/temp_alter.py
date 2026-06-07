import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from dotenv import load_dotenv

load_dotenv()
engine = create_async_engine(os.getenv('DATABASE_URL').replace('postgresql://', 'postgresql+asyncpg://'))

async def main():
    async with engine.begin() as conn:
        await conn.execute(text(
            'ALTER TABLE learning_needs ADD COLUMN IF NOT EXISTS recommendation_snapshot TEXT;'
        ))
        await conn.execute(text(
            'ALTER TABLE learning_needs ADD COLUMN IF NOT EXISTS recommendation_updated_at TIMESTAMP;'
        ))
    print("Done: added recommendation_snapshot + recommendation_updated_at to learning_needs")

if __name__ == '__main__':
    asyncio.run(main())
