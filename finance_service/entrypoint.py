"""ASGI factory for a separately hosted finance service."""
import os
from .api import create_app

def application():
    return create_app(os.environ.get('FINANCE_API_KEY',''))
