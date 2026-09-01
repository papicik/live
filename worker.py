#!/usr/bin/env python3
"""
Autonomous Multi-Agent Background Generator (worker.py)
Mirrors worker.js for direct local execution with python3.
Runs the autonomous multi-agent pipeline every 5 minutes.
"""
import os
import sys
import json
import time
import random
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE_DIR, 'data', 'books.json')
COVERS_DIR = os.path.join(BASE_DIR, 'public', 'covers')

GENRES = [
  'Sci-Fi & Cyberpunk',
  'Fantasy & Mythos',
  'Mystery & Noir',
  'Romance & Drama',
  'Philosophy & Synthetic Lore',
  'Thriller & Horror'
]

GENRE_STOCK = {
  'Sci-Fi & Cyberpunk': 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=700&q=80',
  'Fantasy & Mythos': 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=700&q=80',
  'Mystery & Noir': 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=700&q=80',
  'Romance & Drama': 'https://images.unsplash.com/photo-1518895949257-7621c3c786d7?auto=format&fit=crop&w=700&q=80',
  'Philosophy & Synthetic Lore': 'https://images.unsplash.com/photo-1516110833967-0b5716ca1387?auto=format&fit=crop&w=700&q=80',
  'Thriller & Horror': 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=700&q=80'
}

def curator_agent():
    genre = random.choice(GENRES)
    print(f"[Curator Agent] Target genre selected: {genre}")
    return genre

def architect_agent(genre):
    print(f"[Architect Agent] Planning cypherpunk architecture for {genre}...")
    genre_data = {
        'Sci-Fi & Cyberpunk': {
            'titles': ['The Sovereign Node', 'Consensus Singularity', 'Zero-Knowledge Exodus', 'The Mempool Arbitrage', 'Darkpool Dominion'],
            'authors': ['Kaelen Cross & Synth-9', 'Hal Finney (In Memoriam)', 'Sora Takahashi', 'Elena Rostova'],
            'colors': ['#0f2b38', '#1a163a', '#0d3b36', '#142534'],
            'accent': '#00f0ff',
            'synopsis': 'Autonomous AI validator clusters run sovereign on-chain micro-states beneath Neo-Tokyo, waging high-frequency gas auctions that threaten global network stability.'
        },
        'Fantasy & Mythos': {
            'titles': ['The Genesis Monolith', 'Chants of the Merkle Tree', 'The Altar of Gas', 'Relics of the First Block'],
            'authors': ['Lady Morrigan Thorne', 'Aethelgard the Validator', 'Torstein the Mintmaster', 'Aurelia Vance'],
            'colors': ['#261c14', '#143322', '#3b1a20', '#192f44'],
            'accent': '#dfba53',
            'synopsis': 'In an arcane realm governed by immutable consensus, an exiled runecaster discovers the sacred Genesis Block etched in obsidian, holding the root hash of creation.'
        },
        'Mystery & Noir': {
            'titles': ['The Private Key Heist', 'Dead Man’s Smart Contract', 'Shadows of the Dark Mixer', 'The 51 Percent Syndicate'],
            'authors': ['Vincent Marlowe', 'Arthur Pendelton', 'Jack Kelly (Anon)', 'Nora Hayes'],
            'colors': ['#17181c', '#221915', '#1e2226', '#2d241c'],
            'accent': '#cbd5e1',
            'synopsis': 'A hardboiled on-chain forensic investigator tracks eighty million stolen DAI through zero-knowledge mixers, racing against a corrupt validator syndicate before block finality.'
        },
        'Romance & Drama': {
            'titles': ['Multi-Sig Hearts', 'Liquidation Cascade', 'The Anon & The Architect', 'Vesting in Twilight'],
            'authors': ['Julianna Marchese', 'Henri Duprès', 'Vivienne Zhao', 'Margot Benoit'],
            'colors': ['#4a1226', '#3d182b', '#541c2c', '#422818'],
            'accent': '#fda4af',
            'synopsis': 'Two rival DeFi protocol founders find themselves entangled in a passionate romance, testing their trust as a market-wide liquidation spiral threatens their multi-sig treasury.'
        },
        'Philosophy & Synthetic Lore': {
            'titles': ['The Cypherpunk Ontology', 'Beyond Fiat Reality', 'The Immutability Proofs', 'Ethics of the Machine Consensus'],
            'authors': ['Dr. Arya Valen', 'Nick Szabo-AI', 'Prof. T. V. Turing', 'Satoshi Manifest'],
            'colors': ['#5a2416', '#3d2b15', '#2b1c36', '#153328'],
            'accent': '#fde047',
            'synopsis': 'An epistemological manifesto dissecting the nature of digital scarcity, trustless consensus, and sovereign computational identity against monopolistic state authority.'
        },
        'Thriller & Horror': {
            'titles': ['The Dark Forest Predator', 'Soulbound Contagion', 'The Re-Entrancy Nightmare', 'Seed Phrase of the Damned'],
            'authors': ['Dr. Howard Vance', 'Evelyn Graves', 'Clive Machen', 'Silas Kane'],
            'colors': ['#15161b', '#2a1518', '#321319', '#1c1c20'],
            'accent': '#f87171',
            'synopsis': 'A lone developer who stumbled into the mempool’s dark forest realizes an autonomous predatory MEV entity has infected their hardware wallet, locking them into an irreversible execution loop.'
        }
    }
    pack = genre_data.get(genre, genre_data['Sci-Fi & Cyberpunk'])
    title = random.choice(pack['titles'])
    author = random.choice(pack['authors'])
    spine_color = random.choice(pack['colors'])
    accent_color = pack['accent']
    synopsis = pack['synopsis']
    
    romans = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']
    chapter_names = [
        'The Inciting Disturbance', 'Echoes in the Architecture', 'The Decoded Cipher',
        'Crossroads of Glass', 'Descent into the Lower Strata', 'The Mirage of Certainty',
        'Fractured Frequencies', 'The Crucible of Memory', 'The Core Monolith', 'Embers of Dawn'
    ]
    outlines = [{'chapterNumber': i + 1, 'title': f'Chapter {romans[i]}: {chapter_names[i]}'} for i in range(10)]
    return {
        'title': title,
        'author': author,
        'spineColor': spine_color,
        'accentColor': accent_color,
        'synopsis': synopsis,
        'outlines': outlines
    }

def novelist_agent(arch):
    print(f"[Novelist Agent] Writing 10 complete chapters for \"{arch['title']}\"...")
    chapters = []
    for o in arch['outlines']:
        p1 = f"The silence that preceded {o['title']} was not the absence of sound, but the gathering of consequence. In the heart of {arch['title']}, every atmospheric element seemed to converge upon a fragile point of inflection. {arch['author'].split()[0]} paused beside the observation aperture, tracking the dim amber telemetry as shadows lengthened across the perimeter. The anomaly had manifested days prior, yet only now did its existential weight settle into the marrow of bone and fiber."
        p2 = f"To navigate this threshold required abandoning foundational certainties. Records in the archival vaults spoke of subtle, irreversible shifts: temperature gradients that defied physical law, mathematical proofs that coiled backward into forgotten verses, and low-frequency pulses echoing through deactivated receiver coils. \"Nothing constructed by conscious minds remains wholly inert,\" the chronicler had observed centuries prior. Standing before the open corridor, one could almost hear the great gears of the universe turning in deliberate silence."
        p3 = f"A choice was sealed at three minutes past midnight. The cold mechanical seals were disengaged with steady fingers, releasing the scent of dry ozone and aged paper. Beyond the doorway stretched the lower gallery—far wider than the original blueprints suggested, illuminated only by the faint phosphorescence of mineral veins along the stone. Every step forward made it unmistakably clear: the journey would not conclude with simple answers, but with a transformation of the observer itself."
        p4 = f"As the first signs of dawn began to bleed through the reinforced lattices, the horizon permanently shifted. What had originated as a quiet inquiry in the catalog had evolved into an irrevocable truth. The chapter closed not with resolution, but with the quiet courage to face the storm that lay ahead."
        chapters.append({
            'chapterNumber': o['chapterNumber'],
            'title': o['title'],
            'content': f"{p1}\n\n{p2}\n\n{p3}\n\n{p4}"
        })
    return chapters

def art_director_agent(genre, title):
    print(f"[Art Director Agent] Selecting 3:4 digital art cover for \"{title}\"...")
    return GENRE_STOCK.get(genre, GENRE_STOCK['Sci-Fi & Cyberpunk'])

def archivist_agent(book_record):
    print(f"[Archivist Agent] Shelving \"{book_record['title']}\" into data/books.json...")
    books = []
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, 'r', encoding='utf-8') as f:
                books = json.load(f)
        except Exception:
            books = []
    books.insert(0, book_record)
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(books, f, indent=2)
    print(f"[Archivist Agent] Successfully cataloged. Total library books: {len(books)}")

def run_pipeline():
    genre = curator_agent()
    arch = architect_agent(genre)
    chapters = novelist_agent(arch)
    cover_url = art_director_agent(genre, arch['title'])
    
    book = {
        'id': f"book-{int(time.time() * 1000)}",
        'genre': genre,
        'title': arch['title'],
        'author': arch['author'],
        'pageCount': 20,
        'spineColor': arch['spineColor'],
        'accentColor': arch['accentColor'],
        'width': 24,
        'height': 200,
        'tilt': 0,
        'coverUrl': cover_url,
        'cover_url': cover_url,
        'summary': arch['synopsis'],
        'chapters': chapters,
        'createdAt': datetime.utcnow().isoformat() + 'Z'
    }
    archivist_agent(book)

def loop_worker():
    print("=============================================================")
    print("🏛 Literary Production Pipeline Initialized (Python)")
    print("⏱ Interval: 1 Minute (60 seconds) post-completion")
    print("=============================================================")
    # Run once at startup
    run_pipeline()
    while True:
        time.sleep(60)
        run_pipeline()

if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == '--once':
        run_pipeline()
    else:
        loop_worker()
