import streamlit as st
import fastf1
import fastf1.plotting
from fastf1.ergast import Ergast
import pandas as pd
import numpy as np
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import os
import warnings
warnings.filterwarnings('ignore')

# ==============================================================================
# 1. SYSTEM CONFIGURATION & CSS THEME ENGINE
# ==============================================================================
st.set_page_config(
    page_title="Formula One Analysis",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# Enable FastF1 Cache (Critical for speed)
CACHE_DIR = "cache"
if not os.path.exists(CACHE_DIR):
    os.makedirs(CACHE_DIR)
fastf1.Cache.enable_cache(CACHE_DIR)

# --- CSS: MODERN F1 THEME WITH ANIMATIONS ---
st.markdown("""
<style>
    /* 1. ANIMATED GRADIENT BACKGROUND */
    .stApp { 
        background: linear-gradient(135deg, #0a0e15 0%, #1a1f2e 50%, #0f1419 100%);
        background-size: 400% 400%;
        animation: gradientShift 15s ease infinite;
        color: #e0e0e6;
    }
    
    @keyframes gradientShift {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
    }
    
    .block-container { 
        padding-top: 2rem; 
        padding-bottom: 5rem; 
        max-width: 95% !important; 
    }

    /* 2. GLASSMORPHISM CARDS WITH GLOW */
    div[data-testid="stVerticalBlock"] > div[style*="flex-direction: column;"] > div[data-testid="stVerticalBlock"] {
        background: rgba(21, 25, 34, 0.7);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(225, 6, 0, 0.2);
        border-radius: 16px;
        padding: 24px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5),
                    0 0 40px rgba(225, 6, 0, 0.1);
        transition: all 0.3s ease;
        animation: fadeIn 0.6s ease-out;
    }
    
    div[data-testid="stVerticalBlock"] > div[style*="flex-direction: column;"] > div[data-testid="stVerticalBlock"]:hover {
        transform: translateY(-2px);
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6),
                    0 0 60px rgba(225, 6, 0, 0.2);
        border-color: rgba(225, 6, 0, 0.4);
    }
    
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
    }

    /* 3. MODERN TYPOGRAPHY */
    h1 { 
        font-size: 32px !important; 
        font-weight: 800 !important; 
        background: linear-gradient(135deg, #ffffff 0%, #e10600 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        animation: slideIn 0.8s ease-out;
    }
    
    h2 { 
        font-size: 24px !important; 
        font-weight: 700 !important; 
        color: #ffffff !important;
        text-shadow: 0 0 20px rgba(225, 6, 0, 0.3);
    }
    
    h3 { 
        font-size: 14px !important; 
        text-transform: uppercase; 
        letter-spacing: 2px; 
        color: #8b9bb4 !important; 
        margin-bottom: 16px;
    }
    
    @keyframes slideIn {
        from { transform: translateX(-50px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    /* 4. PREMIUM INPUTS & BUTTONS */
    .stSelectbox div[data-baseweb="select"] > div { 
        background: linear-gradient(135deg, #1e2430 0%, #252d3d 100%) !important;
        border: 1px solid #e10600 !important; 
        color: white !important; 
        border-radius: 8px;
        transition: all 0.3s ease;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }
    
    .stSelectbox div[data-baseweb="select"] > div:hover {
        border-color: #ff0800 !important;
        box-shadow: 0 0 20px rgba(225, 6, 0, 0.4);
    }
    
    .stButton button { 
        background: linear-gradient(135deg, #e10600 0%, #ff0800 100%);
        color: white; 
        font-weight: bold; 
        border: none; 
        border-radius: 8px; 
        padding: 0.6rem 1.2rem;
        transition: all 0.3s ease;
        width: 100%;
        box-shadow: 0 4px 15px rgba(225, 6, 0, 0.3);
        text-transform: uppercase;
        letter-spacing: 1px;
    }
    
    .stButton button:hover { 
        background: linear-gradient(135deg, #ff0800 0%, #e10600 100%);
        box-shadow: 0 6px 25px rgba(225, 6, 0, 0.6);
        transform: translateY(-3px) scale(1.02);
    }
    
    .stButton button:active {
        transform: translateY(-1px) scale(0.98);
    }
    
    .stMultiSelect div[data-baseweb="select"] > div {
        background: linear-gradient(135deg, #1e2430 0%, #252d3d 100%) !important;
        border: 1px solid #363b47 !important;
        border-radius: 8px;
    }
    
    /* 5. ANIMATED METRICS */
    div[data-testid="stMetric"] {
        background: rgba(225, 6, 0, 0.05);
        padding: 12px;
        border-radius: 10px;
        border: 1px solid rgba(225, 6, 0, 0.2);
        transition: all 0.3s ease;
    }
    
    div[data-testid="stMetric"]:hover {
        background: rgba(225, 6, 0, 0.1);
        border-color: rgba(225, 6, 0, 0.4);
        transform: scale(1.05);
    }
    
    div[data-testid="stMetricLabel"] { 
        color: #8b9bb4 !important; 
        font-size: 11px !important; 
        text-transform: uppercase;
        letter-spacing: 1px;
    }
    
    div[data-testid="stMetricValue"] { 
        color: #ffffff !important; 
        font-size: 22px !important;
        font-weight: 700;
        text-shadow: 0 0 10px rgba(225, 6, 0, 0.5);
    }
    
    /* 6. PLOTLY CHARTS */
    .js-plotly-plot .plotly .bg { fill: #151922 !important; }
    .js-plotly-plot {
        border-radius: 12px;
        overflow: hidden;
    }
    
    /* 7. PREMIUM TABS */
    .stTabs [data-baseweb="tab-list"] { 
        gap: 12px; 
        background-color: transparent; 
        padding: 12px 0;
        border-bottom: 2px solid rgba(225, 6, 0, 0.2);
    }
    
    .stTabs [data-baseweb="tab"] { 
        background: linear-gradient(135deg, #1e2430 0%, #252d3d 100%);
        border: 1px solid #2d3340; 
        color: #8b9bb4; 
        border-radius: 10px; 
        padding: 10px 24px; 
        font-size: 13px;
        font-weight: 600;
        transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        position: relative;
        overflow: hidden;
    }
    
    .stTabs [data-baseweb="tab"]::before {
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(225, 6, 0, 0.2), transparent);
        transition: left 0.5s;
    }
    
    .stTabs [data-baseweb="tab"]:hover::before {
        left: 100%;
    }
    
    .stTabs [data-baseweb="tab"]:hover {
        background: linear-gradient(135deg, #252d3d 0%, #2a3442 100%);
        border-color: #e10600;
        transform: translateY(-3px);
        box-shadow: 0 6px 20px rgba(225, 6, 0, 0.3);
        color: #ffffff;
    }
    
    .stTabs [aria-selected="true"] { 
        background: linear-gradient(135deg, #e10600 0%, #ff0800 100%) !important;
        color: white !important; 
        border-color: #e10600 !important; 
        box-shadow: 0 8px 30px rgba(225, 6, 0, 0.5);
        transform: translateY(-3px);
    }
    
    /* 8. DATAFRAMES */
    .stDataFrame { 
        border-radius: 12px; 
        overflow: hidden;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    }
    
    /* 9. CUSTOM SCROLLBAR */
    ::-webkit-scrollbar {
        width: 10px;
        height: 10px;
    }
    ::-webkit-scrollbar-track {
        background: #1e2430;
        border-radius: 10px;
    }
    ::-webkit-scrollbar-thumb {
        background: linear-gradient(135deg, #e10600 0%, #ff0800 100%);
        border-radius: 10px;
        border: 2px solid #1e2430;
    }
    ::-webkit-scrollbar-thumb:hover {
        background: linear-gradient(135deg, #ff0800 0%, #e10600 100%);
        box-shadow: 0 0 10px rgba(225, 6, 0, 0.5);
    }
    
    /* 10. LOADING SPINNER */
    .stSpinner > div {
        border-top-color: #e10600 !important;
    }
    
    /* 11. INFO/WARNING/ERROR BOXES */
    .stAlert {
        border-radius: 10px;
        border-left: 4px solid #e10600;
        animation: slideInRight 0.5s ease-out;
    }
    
    @keyframes slideInRight {
        from { transform: translateX(50px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    /* 12. EXPANDER */
    .streamlit-expanderHeader {
        background: linear-gradient(135deg, #1e2430 0%, #252d3d 100%);
        border-radius: 10px;
        border: 1px solid rgba(225, 6, 0, 0.3);
        transition: all 0.3s ease;
    }
    
    .streamlit-expanderHeader:hover {
        border-color: #e10600;
        box-shadow: 0 4px 20px rgba(225, 6, 0, 0.3);
    }
    
    /* 13. PULSE ANIMATION FOR IMPORTANT ELEMENTS */
    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.8; }
    }
    
    /* 14. MODERN DATAFRAME STYLING */
    .stDataFrame [data-testid="stDataFrameResizable"] {
        border: 1px solid rgba(225, 6, 0, 0.2);
        border-radius: 12px;
    }
    
    /* 15. CAPTION STYLING */
    .stCaption {
        color: #6b7280 !important;
        font-size: 11px !important;
        font-style: italic;
    }
    
    /* 16. SUCCESS/WARNING/ERROR ANIMATIONS */
    .stSuccess {
        animation: successPulse 0.5s ease-out;
        border-left: 4px solid #00ff41 !important;
    }
    
    .stWarning {
        animation: warningShake 0.5s ease-out;
        border-left: 4px solid #ffd700 !important;
    }
    
    .stError {
        animation: errorShake 0.5s ease-out;
        border-left: 4px solid #ff1e1e !important;
    }
    
    @keyframes successPulse {
        0% { transform: scale(0.95); opacity: 0; }
        50% { transform: scale(1.02); }
        100% { transform: scale(1); opacity: 1; }
    }
    
    @keyframes warningShake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-5px); }
        75% { transform: translateX(5px); }
    }
    
    @keyframes errorShake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-3px); }
        20%, 40%, 60%, 80% { transform: translateX(3px); }
    }
    
    /* 17. GLOW EFFECT FOR ACTIVE ELEMENTS */
    .stPlotlyChart:hover {
        filter: brightness(1.05);
        transition: filter 0.3s ease;
    }
</style>
""", unsafe_allow_html=True)


# ==============================================================================
# 2. DATA ENGINE: DYNAMIC ANALYST SYSTEM
# ==============================================================================

@st.cache_data(ttl=86400)  # Cache for 24h
def fetch_ergast_standings(year):
    """
    Dynamically fetches full grid driver/team standings for ANY year using FastF1 Ergast API.
    """
    ergast = Ergast()
    try:
        # Fetch Drivers
        drivers = ergast.get_driver_standings(season=year)
        d_df = drivers.content[0]
        # Simplify Columns
        d_simple = d_df[['position', 'givenName', 'familyName', 'constructorNames', 'points', 'wins']].copy()
        d_simple['Driver'] = d_simple['givenName'] + " " + d_simple['familyName']
        d_simple['Team'] = d_simple['constructorNames'].apply(lambda x: x[0] if len(x) > 0 else "N/A")
        d_simple.rename(columns={'position': 'Pos', 'points': 'Points', 'wins': 'Wins'}, inplace=True)
        d_simple = d_simple[['Pos', 'Driver', 'Team', 'Points', 'Wins']]

        # Fetch Constructors
        teams = ergast.get_constructor_standings(season=year)
        t_df = teams.content[0]
        t_simple = t_df[['position', 'constructorName', 'points', 'wins']].copy()
        t_simple.rename(columns={'position': 'Pos', 'constructorName': 'Team', 'points': 'Points', 'wins': 'Wins'},
                        inplace=True)

        # Determine Champion
        champ_driver = d_simple.iloc[0]['Driver']
        champ_team = t_simple.iloc[0]['Team']

        return {
            'drivers': d_simple,
            'teams': t_simple,
            'champion_driver': champ_driver,
            'champion_team': champ_team
        }
    except Exception as e:
        return None


def get_analyst_data(year):
    """
    Smart Router:
    - Use Hardcoded 'Projected' data for 2025.
    - Use Live Ergast API for 2018-2024.
    """
    if year == 2025:
        # FUTURE CONTEXT MOCK DATA
        d_data = pd.DataFrame([
            {"Pos": 1, "Driver": "Lando Norris", "Team": "McLaren", "Points": 408, "Wins": 7},
            {"Pos": 2, "Driver": "Max Verstappen", "Team": "Red Bull", "Points": 396, "Wins": 8},
            {"Pos": 3, "Driver": "Oscar Piastri", "Team": "McLaren", "Points": 392, "Wins": 6},
            {"Pos": 4, "Driver": "George Russell", "Team": "Mercedes", "Points": 309, "Wins": 3},
            {"Pos": 5, "Driver": "Charles Leclerc", "Team": "Ferrari", "Points": 230, "Wins": 0},
            {"Pos": 6, "Driver": "Lewis Hamilton", "Team": "Ferrari", "Points": 152, "Wins": 1},
            {"Pos": 7, "Driver": "Kimi Antonelli", "Team": "Mercedes", "Points": 150, "Wins": 0},
            {"Pos": 8, "Driver": "Alex Albon", "Team": "Williams", "Points": 73, "Wins": 0},
            {"Pos": 9, "Driver": "Carlos Sainz", "Team": "Williams", "Points": 64, "Wins": 0},
            {"Pos": 10, "Driver": "Liam Lawson", "Team": "Red Bull", "Points": 50, "Wins": 0},
            {"Pos": 11, "Driver": "Fernando Alonso", "Team": "Aston Martin", "Points": 48, "Wins": 0},
            {"Pos": 12, "Driver": "Yuki Tsunoda", "Team": "Racing Bulls", "Points": 42, "Wins": 0},
            {"Pos": 13, "Driver": "Lance Stroll", "Team": "Aston Martin", "Points": 32, "Wins": 0},
            {"Pos": 14, "Driver": "Nico Hulkenberg", "Team": "Sauber", "Points": 28, "Wins": 0},
            {"Pos": 15, "Driver": "Isack Hadjar", "Team": "Racing Bulls", "Points": 25, "Wins": 0},
            {"Pos": 16, "Driver": "Esteban Ocon", "Team": "Haas", "Points": 20, "Wins": 0},
            {"Pos": 17, "Driver": "Pierre Gasly", "Team": "Alpine", "Points": 18, "Wins": 0},
            {"Pos": 18, "Driver": "Oliver Bearman", "Team": "Haas", "Points": 15, "Wins": 0},
            {"Pos": 19, "Driver": "Gabriel Bortoleto", "Team": "Sauber", "Points": 12, "Wins": 0},
            {"Pos": 20, "Driver": "Jack Doohan", "Team": "Alpine", "Points": 4, "Wins": 0},
        ])
        t_data = pd.DataFrame([
            {"Pos": 1, "Team": "McLaren", "Points": 800, "Wins": 13},
            {"Pos": 2, "Team": "Mercedes", "Points": 459, "Wins": 3},
            {"Pos": 3, "Team": "Red Bull", "Points": 446, "Wins": 8},
            {"Pos": 4, "Team": "Ferrari", "Points": 382, "Wins": 1},
            {"Pos": 5, "Team": "Williams", "Points": 137, "Wins": 0},
            {"Pos": 6, "Team": "Racing Bulls", "Points": 67, "Wins": 0},
            {"Pos": 7, "Team": "Aston Martin", "Points": 80, "Wins": 0},
            {"Pos": 8, "Team": "Sauber", "Points": 40, "Wins": 0},
            {"Pos": 9, "Team": "Haas", "Points": 35, "Wins": 0},
            {"Pos": 10, "Team": "Alpine", "Points": 22, "Wins": 0},
        ])
        return {'drivers': d_data, 'teams': t_data, 'champion_driver': "Lando Norris (Proj)",
                'champion_team': "McLaren (Proj)"}
    else:
        # LIVE FETCH
        return fetch_ergast_standings(year)


@st.cache_data
def get_schedule(year):
    """Fetches the official schedule."""
    try:
        schedule = fastf1.get_event_schedule(year, include_testing=False)
        if not schedule.empty: return schedule
    except:
        pass

    # 2025 Fallback Calendar
    if year == 2025:
        return pd.DataFrame({
            'RoundNumber': range(1, 25),
            'EventName': ["Australian GP", "Chinese GP", "Japanese GP", "Bahrain GP", "Saudi Arabian GP", "Miami GP",
                          "Emilia Romagna GP", "Monaco GP", "Spanish GP", "Canadian GP", "Austrian GP", "British GP",
                          "Belgian GP", "Hungarian GP", "Dutch GP", "Italian GP", "Azerbaijan GP", "Singapore GP",
                          "United States GP", "Mexico City GP", "São Paulo GP", "Las Vegas GP", "Qatar GP",
                          "Abu Dhabi GP"],
            'Location': ["Melbourne", "Shanghai", "Suzuka", "Sakhir", "Jeddah", "Miami", "Imola", "Monaco", "Barcelona",
                         "Montreal", "Spielberg", "Silverstone", "Spa", "Budapest", "Zandvoort", "Monza", "Baku",
                         "Singapore", "Austin", "Mexico City", "Sao Paulo", "Las Vegas", "Lusail", "Yas Marina"]
        })
    return pd.DataFrame()


@st.cache_data(ttl=600, show_spinner=False)
def load_session_data(year, event, session_code):
    """Load session data with telemetry - cached for speed"""
    try:
        session = fastf1.get_session(year, event, session_code)
        session.load(telemetry=True, laps=True, weather=False)
        return session
    except:
        return None


def get_color(driver, session):
    try:
        return fastf1.plotting.get_driver_color(driver, session=session)
    except:
        return "#ffffff"


def fmt_time(sec):
    if pd.isna(sec): return ""
    m, s = divmod(sec, 60)
    return f"{int(m)}:{s:06.3f}"


def calculate_tire_degradation(laps_df, driver):
    """Calculate tire degradation rate per compound - optimized"""
    try:
        driver_laps = laps_df[laps_df['Driver'] == driver].copy()
        
        degradation_data = {}
        compounds = driver_laps['Compound'].dropna().unique()
        
        for compound in compounds:
            compound_laps = driver_laps[driver_laps['Compound'] == compound].copy()
            compound_laps = compound_laps.dropna(subset=['LapTime'])
            
            if len(compound_laps) > 3:
                times = compound_laps['LapTime'].dt.total_seconds()
                
                # Quick degradation calculation
                if len(times) > 1:
                    deg_rate = (times.iloc[-1] - times.iloc[0]) / len(times)
                    degradation_data[compound] = {
                        'rate': deg_rate,
                        'laps': len(compound_laps),
                        'avg_time': times.mean()
                    }
        
        return degradation_data
    except:
        return {}


def analyze_sector_performance(laps_df, drivers):
    """Analyze sector times for selected drivers - optimized"""
    sector_data = {}
    
    try:
        for driver in drivers:
            driver_laps = laps_df[laps_df['Driver'] == driver].copy()
            
            # Get clean laps (no pit, no incidents)
            clean_laps = driver_laps[
                (driver_laps['IsAccurate'] == True) &
                (driver_laps['PitOutTime'].isna())
            ].copy()
            
            if len(clean_laps) > 0 and all(col in clean_laps.columns for col in ['Sector1Time', 'Sector2Time', 'Sector3Time']):
                s1_times = clean_laps['Sector1Time'].dropna().dt.total_seconds()
                s2_times = clean_laps['Sector2Time'].dropna().dt.total_seconds()
                s3_times = clean_laps['Sector3Time'].dropna().dt.total_seconds()
                
                if len(s1_times) > 0 and len(s2_times) > 0 and len(s3_times) > 0:
                    sector_data[driver] = {
                        'S1': s1_times.min(),
                        'S2': s2_times.min(),
                        'S3': s3_times.min(),
                        'S1_avg': s1_times.mean(),
                        'S2_avg': s2_times.mean(),
                        'S3_avg': s3_times.mean(),
                    }
    except:
        pass
    
    return sector_data


def get_stint_analysis(laps_df, driver):
    """Analyze pit stop strategy and stint performance"""
    driver_laps = laps_df[laps_df['Driver'] == driver].copy()
    
    stints = []
    current_stint = []
    
    for idx, lap in driver_laps.iterrows():
        current_stint.append(lap)
        
        # Check if next lap has pit stop
        if not pd.isna(lap['PitInTime']):
            if current_stint:
                stint_df = pd.DataFrame(current_stint)
                # Convert LapTime to seconds properly
                lap_times = pd.to_timedelta(stint_df['LapTime']).dt.total_seconds()
                stints.append({
                    'compound': stint_df['Compound'].mode()[0] if len(stint_df['Compound'].mode()) > 0 else 'UNKNOWN',
                    'laps': len(stint_df),
                    'start_lap': stint_df['LapNumber'].min(),
                    'end_lap': stint_df['LapNumber'].max(),
                    'avg_time': lap_times.mean()
                })
                current_stint = []
    
    # Add final stint
    if current_stint:
        stint_df = pd.DataFrame(current_stint)
        lap_times = pd.to_timedelta(stint_df['LapTime']).dt.total_seconds()
        stints.append({
            'compound': stint_df['Compound'].mode()[0] if len(stint_df['Compound'].mode()) > 0 else 'UNKNOWN',
            'laps': len(stint_df),
            'start_lap': stint_df['LapNumber'].min(),
            'end_lap': stint_df['LapNumber'].max(),
            'avg_time': lap_times.mean()
        })
    
    return stints


def calculate_race_consistency(laps_df, driver):
    """Calculate driver consistency metrics"""
    driver_laps = laps_df[laps_df['Driver'] == driver].copy()
    
    # Remove outliers (pit laps, slow laps)
    clean_laps = driver_laps[
        (driver_laps['PitOutTime'].isna()) &
        (driver_laps['PitInTime'].isna())
    ].copy()
    
    if len(clean_laps) > 5:
        times = clean_laps['LapTime'].dt.total_seconds()
        median_time = times.median()
        
        # Remove laps that are >10% slower than median
        consistent_laps = times[times < median_time * 1.1]
        
        return {
            'std_dev': consistent_laps.std(),
            'mean': consistent_laps.mean(),
            'consistency_score': 100 * (1 - consistent_laps.std() / consistent_laps.mean())
        }
    
    return None


def calculate_gap_analysis(laps_df, driver1, driver2):
    """Calculate gap between two drivers throughout the race"""
    laps1 = laps_df[laps_df['Driver'] == driver1].copy()
    laps2 = laps_df[laps_df['Driver'] == driver2].copy()
    
    # Merge on lap number to get gaps
    merged = pd.merge(
        laps1[['LapNumber', 'LapTime', 'Position']],
        laps2[['LapNumber', 'LapTime', 'Position']],
        on='LapNumber',
        suffixes=('_1', '_2')
    )
    
    if len(merged) > 0:
        merged['TimeDelta'] = (merged['LapTime_2'] - merged['LapTime_1']).dt.total_seconds()
        merged['CumulativeGap'] = merged['TimeDelta'].cumsum()
        return merged
    
    return None


def get_speed_trap_data(laps_df, drivers):
    """Get maximum speed for each driver - optimized version"""
    speed_data = {}
    
    # Limit to top 5 drivers to avoid long loading times
    limited_drivers = drivers[:5]
    
    for driver in limited_drivers:
        try:
            driver_laps = laps_df[laps_df['Driver'] == driver]
            # Only process first 10 laps for speed estimate
            sample_laps = driver_laps.head(10)
            max_speeds = []
            
            for idx, lap in sample_laps.iterrows():
                try:
                    tel = lap.get_telemetry()
                    if 'Speed' in tel.columns:
                        max_speeds.append(tel['Speed'].max())
                except:
                    continue
            
            if max_speeds:
                speed_data[driver] = {
                    'max': max(max_speeds),
                    'avg_max': np.mean(max_speeds)
                }
        except:
            continue
    
    return speed_data


def analyze_quali_laps(session):
    """Analyze qualifying session laps"""
    try:
        laps = session.laps
        
        # Get best lap per driver
        best_laps = laps.groupby('Driver').apply(
            lambda x: x.loc[x['LapTime'].idxmin()]
        ).reset_index(drop=True)
        
        best_laps = best_laps.sort_values('LapTime')
        
        # Calculate gaps to pole
        pole_time = best_laps['LapTime'].iloc[0]
        best_laps['GapToPole'] = (best_laps['LapTime'] - pole_time).dt.total_seconds()
        
        return best_laps
    except:
        return None


def get_weather_summary(session):
    """Get weather data summary if available"""
    try:
        if hasattr(session, 'weather_data') and session.weather_data is not None:
            weather = session.weather_data
            return {
                'avg_air_temp': weather['AirTemp'].mean(),
                'avg_track_temp': weather['TrackTemp'].mean(),
                'avg_humidity': weather['Humidity'].mean(),
                'rainfall': weather['Rainfall'].sum() > 0
            }
    except:
        pass
    return None


# ==============================================================================
# 3. MAIN APPLICATION LOGIC
# ==============================================================================

# --- HEADER ---
st.markdown("<h1 style='text-align: center; color: #e10600; font-size: 38px; font-weight: 900; letter-spacing: 4px; margin-bottom: 0.5rem;'>FORMULA 1 ANALYSIS SYSTEM</h1>", unsafe_allow_html=True)
st.markdown("<p style='text-align: center; color: #8b9bb4; font-size: 13px; letter-spacing: 2px; margin-bottom: 1rem;'>Advanced Telemetry & Historical Data System | Powered by FastF1</p>", unsafe_allow_html=True)

# --- NEXT RACE COUNTDOWN ---
try:
    from datetime import datetime, timedelta
    import pytz
    
    # Get 2025 schedule
    schedule_2025 = get_schedule(2025)
    if not schedule_2025.empty and 'EventDate' in schedule_2025.columns:
        now = datetime.now(pytz.UTC)
        
        # Find next race
        upcoming_races = []
        for idx, race in schedule_2025.iterrows():
            try:
                if pd.notna(race.get('EventDate')):
                    race_date = pd.to_datetime(race['EventDate'])
                    if not race_date.tzinfo:
                        race_date = pytz.UTC.localize(race_date)
                    
                    if race_date > now:
                        upcoming_races.append({
                            'name': race['EventName'],
                            'location': race.get('Location', 'TBA'),
                            'date': race_date,
                            'round': race.get('RoundNumber', '?')
                        })
            except:
                continue
        
        if upcoming_races:
            # Sort by date and get next race
            upcoming_races.sort(key=lambda x: x['date'])
            next_race = upcoming_races[0]
            
            # Calculate countdown
            time_diff = next_race['date'] - now
            days = time_diff.days
            hours = time_diff.seconds // 3600
            
            # Display countdown banner
            col_cd1, col_cd2, col_cd3 = st.columns([1, 2, 1])
            with col_cd2:
                st.markdown(f"""
                <div style='
                    background: linear-gradient(135deg, rgba(225,6,0,0.2) 0%, rgba(255,8,0,0.1) 100%);
                    border: 2px solid #e10600;
                    border-radius: 12px;
                    padding: 1rem;
                    text-align: center;
                    margin-bottom: 1.5rem;
                    box-shadow: 0 4px 20px rgba(225, 6, 0, 0.3);
                '>
                    <div style='color: #8b9bb4; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 0.3rem;'>
                        Next Race
                    </div>
                    <div style='color: #ffffff; font-size: 22px; font-weight: 800; margin-bottom: 0.3rem;'>
                        {next_race['name']}
                    </div>
                    <div style='color: #e10600; font-size: 28px; font-weight: 900; margin-bottom: 0.3rem;'>
                        {days} DAYS {hours} HOURS
                    </div>
                    <div style='color: #8b9bb4; font-size: 12px;'>
                        {next_race['location']} • Round {next_race['round']} • {next_race['date'].strftime('%B %d, %Y')}
                    </div>
                </div>
                """, unsafe_allow_html=True)
except:
    pass

# --- MAIN TABS ---
tab_dashboard, tab_telemetry, tab_championship, tab_comparison = st.tabs([
    "Race Analysis", 
    "Telemetry Deep Dive", 
    "Championship", 
    "Driver Comparison"
])

# ==============================================================================
# TAB 1: RACE ANALYSIS DASHBOARD
# ==============================================================================
with tab_dashboard:
    # --- CONTROL PANEL ---
    with st.container():
        c_ctrl1, c_ctrl2, c_ctrl3, c_ctrl4 = st.columns([1, 2, 1, 1])

        with c_ctrl1:
            # Full Range Year Selector
            sel_year = st.selectbox("Season", range(2025, 2017, -1), index=0, key="dash_year")

        with c_ctrl2:
            # Dynamic Race Selector
            schedule = get_schedule(sel_year)
            if not schedule.empty:
                schedule['Display'] = schedule.apply(lambda x: f"R{x['RoundNumber']} - {x['EventName']}", axis=1)
                def_idx = 18 if sel_year == 2025 and len(schedule) > 18 else 0
                sel_event_disp = st.selectbox("Grand Prix", schedule['Display'], index=def_idx)
                sel_event = schedule.loc[schedule['Display'] == sel_event_disp, 'EventName'].values[0]
            else:
                sel_event = st.text_input("Grand Prix", "United States Grand Prix")

        with c_ctrl3:
            sel_session = st.selectbox("Session", ["Race", "Qualifying", "Sprint", "FP1", "FP2", "FP3"], index=0)
            sess_map = {"Race": "R", "Qualifying": "Q", "Sprint": "S", "FP1": "FP1", "FP2": "FP2", "FP3": "FP3"}

        with c_ctrl4:
            st.write("")  # Layout spacer
            load_btn = st.button("LOAD DATA", use_container_width=True)

    # --- SESSION STATE MANAGEMENT ---
    if "session_obj" not in st.session_state: 
        st.session_state.session_obj = None
        # Show helpful tip on first load
        st.info("Performance Tip: First load takes 10-30 seconds. Subsequent loads are instant thanks to caching!")

    if load_btn:
        with st.spinner("Loading session data... (10-30 seconds, much faster on reload)"):
            st.session_state.session_obj = load_session_data(sel_year, sel_event, sess_map[sel_session])
            if st.session_state.session_obj:
                st.success("Loaded successfully!")
            else:
                st.error("Failed to load. Try another race.")

    # --- DASHBOARD VISUALS ---
    if st.session_state.session_obj:
        session = st.session_state.session_obj
        laps = session.laps
        laps['LapTimeSec'] = laps['LapTime'].dt.total_seconds()

        # 1. DRIVER SELECTION (FULL GRID)
        try:
            all_drivers = session.results.sort_values(by="Position")['Abbreviation'].tolist()
        except:
            all_drivers = pd.unique(laps['Driver']).tolist()

        st.markdown("###  Race Overview & Results")
        
        # Race statistics banner
        col_stat1, col_stat2, col_stat3, col_stat4, col_stat5 = st.columns(5)
        
        try:
            total_laps = int(laps['LapNumber'].max())
            unique_drivers = len(laps['Driver'].unique())
            fastest_lap = laps.pick_fastest()
            
            col_stat1.metric(" Total Laps", total_laps)
            col_stat2.metric(" Drivers", unique_drivers)
            col_stat3.metric(" Fastest", f"{fastest_lap['Driver']}")
            col_stat4.metric(" Best Time", fmt_time(fastest_lap['LapTime'].total_seconds()))
            
            # Weather info if available
            weather = get_weather_summary(session)
            if weather:
                col_stat5.metric(" Track Temp", f"{weather['avg_track_temp']:.1f}°C")
            else:
                col_stat5.metric(" Session", sel_session)
        except:
            pass
        
        st.markdown("")
        
        # Results table
        try:
            results_df = session.results[['Position', 'Abbreviation', 'TeamName', 'GridPosition', 'Status', 'Points']].copy()
            results_df.columns = ['Pos', 'Driver', 'Team', 'Grid', 'Status', 'Points']
            results_df['Positions Gained'] = results_df['Grid'] - results_df['Pos']
            
            col_results, col_fastest = st.columns([3, 2])
            
            with col_results:
                st.markdown("####  Final Classification")
                st.dataframe(
                    results_df.head(10),
                    use_container_width=True,
                    hide_index=True,
                    height=400,
                    column_config={
                        "Positions Gained": st.column_config.NumberColumn(
                            "Pos ±",
                            help="Positions gained/lost from grid",
                            format="%+d"
                        )
                    }
                )
            
            with col_fastest:
                st.markdown("####  Fastest Laps")
                fastest_per_driver = laps.groupby('Driver').apply(
                    lambda x: x.nsmallest(1, 'LapTimeSec')[['LapNumber', 'LapTimeSec', 'Compound']]
                ).reset_index(drop=False)
                fastest_per_driver = fastest_per_driver.sort_values('LapTimeSec').head(10)
                fastest_per_driver['LapTime'] = fastest_per_driver['LapTimeSec'].apply(fmt_time)
                
                st.dataframe(
                    fastest_per_driver[['Driver', 'LapNumber', 'LapTime', 'Compound']],
                    use_container_width=True,
                    hide_index=True,
                    height=400
                )
        except Exception as e:
            st.warning(f"Results data not available")

        st.markdown("---")
        st.markdown("###  Driver Selection & Pace Analysis")
        
        selected_drivers = st.multiselect(
            "Select Drivers to Analyze",
            all_drivers,
            default=all_drivers[:5] if len(all_drivers) >= 5 else all_drivers,
            key="drivers_multi"
        )

        if not selected_drivers: 
            selected_drivers = all_drivers[:5]

        # Filter Data
        drv_laps = laps[laps['Driver'].isin(selected_drivers)]

        # 2. PACE COMPARISON & TRACK MAP
        col_viz_left, col_viz_right = st.columns([2, 1])

        with col_viz_left:
            st.markdown("#### Lap Time Distribution")
            clean_laps = drv_laps.dropna(subset=['LapTimeSec'])
            clean_laps = clean_laps[clean_laps['LapTimeSec'] < clean_laps['LapTimeSec'].median() * 1.15]

            fig_pace = go.Figure()
            for d in selected_drivers:
                d_data = clean_laps[clean_laps['Driver'] == d]
                color = get_color(d, session)

                fig_pace.add_trace(go.Box(
                    y=d_data['LapTimeSec'],
                    name=d,
                    marker_color=color,
                    boxmean=True,
                    boxpoints='outliers',
                    line=dict(width=2),
                    fillcolor=color,
                    width=0.6
                ))

            fig_pace.update_layout(
                template="plotly_dark",
                height=400,
                showlegend=False,
                yaxis_title="Lap Time (seconds)",
                xaxis_title="Driver",
                margin=dict(t=20, b=40, l=60, r=20),
                paper_bgcolor='rgba(0,0,0,0)',
                plot_bgcolor='rgba(255,255,255,0.03)',
                xaxis=dict(tickfont=dict(size=12, family="Segoe UI")),
                yaxis=dict(gridcolor='#2d3340', zerolinecolor='#2d3340')
            )
            st.plotly_chart(fig_pace, use_container_width=True)

        with col_viz_right:
            st.markdown(f"####  {session.event.EventName}")

            # KEY METRICS
            try:
                fl = laps.pick_fastest()
                winner = session.results.iloc[0]['Abbreviation'] if hasattr(session, 'results') else "N/A"

                st.metric(" Winner", winner)
                st.metric(" Fastest Lap", f"{fl['Driver']}", fmt_time(fl['LapTimeSec']))
                st.metric(" Total Laps", int(laps['LapNumber'].max()))
            except:
                pass

            # TRACK MAP - Enhanced with DRS, Speed Trap, Turn Numbers
            try:
                fl_lap = laps.pick_fastest()
                tel = fl_lap.get_telemetry().add_distance()
                
                if tel is None or len(tel) == 0:
                    raise ValueError("No telemetry data")
                
                # Detect sectors
                total_dist = tel['Distance'].max()
                tel['Sector'] = 1
                tel.loc[tel['Distance'] <= total_dist / 3, 'Sector'] = 1
                tel.loc[(tel['Distance'] > total_dist / 3) & (tel['Distance'] <= 2 * total_dist / 3), 'Sector'] = 2
                tel.loc[tel['Distance'] > 2 * total_dist / 3, 'Sector'] = 3
                
                fig_map = go.Figure()
                
                # Sector colors (như hình: Cyan, Yellow, Red)
                sector_colors = {
                    1: '#ffd700',  # Yellow for Sector 1
                    2: '#00d9ff',  # Cyan for Sector 2  
                    3: '#ff1e1e'   # Red for Sector 3
                }
                
                # Draw sectors
                for sector in [1, 2, 3]:
                    sector_data = tel[tel['Sector'] == sector].copy()
                    if len(sector_data) > 0:
                        fig_map.add_trace(go.Scatter(
                            x=sector_data['X'], 
                            y=sector_data['Y'],
                    mode='lines',
                            line=dict(width=8, color=sector_colors[sector]),
                            name=f'SECTOR {sector}',
                            showlegend=False,
                            hovertemplate=f'Sector {sector}<br>Speed: %{{customdata:.0f}} km/h<extra></extra>',
                            customdata=sector_data['Speed'] if 'Speed' in sector_data.columns else None
                        ))
                
                # Initialize corners counter
                num_corners = 0
                
                # Detect & label ALL turns
                if len(tel) > 50:
                    try:
                        tel['dx'] = tel['X'].diff()
                        tel['dy'] = tel['Y'].diff()
                        tel['angle'] = np.arctan2(tel['dy'], tel['dx'])
                        tel['angle_change'] = tel['angle'].diff().abs()
                        
                        # Find turns with lower threshold for more detection
                        corners = tel[tel['angle_change'] > 0.25].copy()
                        
                        # Limit to ~18 major turns
                        if len(corners) > 18:
                            step = max(1, len(corners) // 18)
                            corners = corners.iloc[::step][:18]
                        
                        # Add turn numbers
                        for i, (idx, corner) in enumerate(corners.iterrows(), 1):
                            fig_map.add_annotation(
                                x=corner['X'],
                                y=corner['Y'],
                                text=f'<b>{i:02d}</b>',
                                showarrow=False,
                                font=dict(size=11, color='white', family='Arial Black'),
                                bgcolor='rgba(0,0,0,0.8)',
                                borderpad=3
                            )
                        
                        # Sector labels (lớn hơn)
                        sector_names = {1: 'SECTOR 1', 2: 'SECTOR 2', 3: 'SECTOR 3'}
                        for sector_num in [1, 2, 3]:
                            sector_data = tel[tel['Sector'] == sector_num]
                            if len(sector_data) > 10:
                                mid_point = sector_data.iloc[len(sector_data) // 2]
                                fig_map.add_annotation(
                                    x=mid_point['X'], 
                                    y=mid_point['Y'],
                                    text=f'<b>{sector_names[sector_num]}</b>',
                                    showarrow=False,
                                    font=dict(size=10, color=sector_colors[sector_num], family='Arial Black'),
                                    bgcolor='rgba(0,0,0,0.6)',
                                    bordercolor=sector_colors[sector_num],
                                    borderwidth=2,
                                    borderpad=4
                                )
                        
                        # DRS Detection Zone (green box)
                        if len(tel) > 0:
                            drs_zone = tel.iloc[int(len(tel) * 0.15)]
                            fig_map.add_annotation(
                                x=drs_zone['X'],
                                y=drs_zone['Y'],
                                text='<b>DRS<br>DETECTION<br>ZONE 1</b>',
                                showarrow=True,
                                arrowhead=2,
                                arrowcolor='#00ff41',
                                ax=50, ay=-50,
                                font=dict(size=8, color='white', family='Arial Black'),
                                bgcolor='#00aa00',
                                bordercolor='#00ff41',
                                borderwidth=2,
                                borderpad=4
                            )
                        
                        # Speed Trap (pink box)
                        if len(tel) > 0:
                            speed_trap = tel.iloc[int(len(tel) * 0.25)]
                            fig_map.add_annotation(
                                x=speed_trap['X'],
                                y=speed_trap['Y'],
                                text='<b>SPEED<br>TRAP</b>',
                                showarrow=True,
                                arrowhead=2,
                                arrowcolor='#ff00ff',
                                ax=60, ay=30,
                                font=dict(size=9, color='white', family='Arial Black'),
                                bgcolor='#ff00ff',
                                bordercolor='#ff00ff',
                                borderwidth=2,
                                borderpad=4
                            )
                        
                        # Finish Line marker
                        if len(tel) > 0:
                            finish = tel.iloc[0]
                            fig_map.add_trace(go.Scatter(
                                x=[finish['X']], 
                                y=[finish['Y']],
                                mode='markers',
                                marker=dict(size=12, color='white', symbol='square', 
                                          line=dict(color='#e10600', width=3)),
                                showlegend=False,
                                hovertext='Finish Line'
                            ))
                    except:
                        pass
                
                # Caption
                caption_text = f"{session.event.EventName}"
                if num_corners > 0:
                    caption_text += f" - {num_corners} turns"
                st.caption(caption_text)
                
                fig_map.update_layout(
                    template="plotly_dark",
                    height=280,
                    margin=dict(t=10, b=10, l=10, r=10),
                    xaxis=dict(visible=False, scaleanchor="y", scaleratio=1),
                    yaxis=dict(visible=False),
                    paper_bgcolor='#0e1117',
                    plot_bgcolor='#0e1117',
                    showlegend=False
                )
                st.plotly_chart(fig_map, use_container_width=True)
                
            except Exception as e:
                # Fallback: Simple track map without labels
                try:
                    fl_lap = laps.pick_fastest()
                    tel = fl_lap.get_telemetry().add_distance()
                    if tel is not None and len(tel) > 0:
                        fig_simple = go.Figure()
                        fig_simple.add_trace(go.Scatter(
                            x=tel['X'], 
                            y=tel['Y'],
                            mode='lines',
                            line=dict(width=6, color='#e10600'),
                            showlegend=False
                        ))
                        fig_simple.update_layout(
                            template="plotly_dark",
                            height=280,
                            margin=dict(t=10, b=10, l=10, r=10),
                            xaxis=dict(visible=False, scaleanchor="y", scaleratio=1),
                            yaxis=dict(visible=False),
                            paper_bgcolor='#0e1117',
                            plot_bgcolor='#0e1117',
                            showlegend=False
                        )
                        st.plotly_chart(fig_simple, use_container_width=True)
                        st.caption(f"{session.event.EventName} - Basic Track Outline")
                    else:
                        st.info("Track map unavailable (no telemetry data)")
                except:
                    st.info("Track map unavailable for this session")

        # 3. LAP TIME PROGRESSION - Improved with outlier filtering
        st.markdown("###  Lap Time Progression & Race Strategy")

        # Prepare data with better outlier filtering
        plot_data = []
        for d in selected_drivers:
            d_data = drv_laps[drv_laps['Driver'] == d].copy()
            
            # Remove obvious outliers (pit laps, slow laps)
            if len(d_data) > 0:
                # Calculate median for this driver
                median_time = d_data['LapTimeSec'].median()
                
                # Keep only laps within reasonable range (median ± 20%)
                d_filtered = d_data[
                    (d_data['LapTimeSec'] >= median_time * 0.8) &
                    (d_data['LapTimeSec'] <= median_time * 1.2)
                ].copy()
                
                plot_data.append({
                    'driver': d,
                    'data': d_filtered,
                    'color': get_color(d, session)
                })

        fig_prog = go.Figure()
        
        # Calculate smart Y-axis range from filtered data
        all_times = []
        for driver_data in plot_data:
            if len(driver_data['data']) > 0:
                all_times.extend(driver_data['data']['LapTimeSec'].tolist())
        
        if len(all_times) > 0:
            y_min = min(all_times) - 1
            y_max = max(all_times) + 2
        else:
            y_min, y_max = None, None
        
        # Plot filtered data
        for driver_data in plot_data:
            d = driver_data['driver']
            d_filtered = driver_data['data']
            color = driver_data['color']

            fig_prog.add_trace(go.Scattergl(
                x=d_filtered['LapNumber'],
                y=d_filtered['LapTimeSec'],
                mode='lines+markers',
                name=d,
                line=dict(color=color, width=2.5),
                marker=dict(size=4),
                opacity=0.85,
                hovertemplate='<b>%{fullData.name}</b><br>Lap: %{x}<br>Time: %{y:.3f}s<extra></extra>'
            ))

        fig_prog.update_layout(
            template="plotly_dark",
            height=450,
            yaxis=dict(
                range=[y_min, y_max], 
                gridcolor='#2d3340', 
                title="Lap Time (seconds)",
                tickformat='.1f'
            ),
            xaxis=dict(
                gridcolor='#2d3340', 
                title="Lap Number",
                tickmode='linear',
                dtick=5
            ),
            margin=dict(t=20, b=40, l=60, r=20),
            legend=dict(
                orientation="h", 
                y=1.02, 
                x=0, 
                bgcolor='rgba(0,0,0,0.5)',
                font=dict(size=11)
            ),
            paper_bgcolor='rgba(0,0,0,0)',
            plot_bgcolor='rgba(255,255,255,0.03)',
            hovermode='x unified'
        )
        
        st.plotly_chart(fig_prog, use_container_width=True)
        st.caption("Note: Outlier laps (pit stops, incidents) filtered for better visualization. Showing laps within 80-120% of median lap time.")

        # 4. TIRE STRATEGY VISUALIZATION
        st.markdown("###  Tire Strategy & Stint Analysis")
        
        col_strat1, col_strat2 = st.columns([2, 1])
        
        with col_strat1:
            # Tire strategy chart
            fig_strat = go.Figure()
            
            tire_colors = {
                'SOFT': '#FF3333',
                'MEDIUM': '#FFF200', 
                'HARD': '#EBEBEB',
                'INTERMEDIATE': '#43B02A',
                'WET': '#0067AD'
            }
            
            for idx, d in enumerate(selected_drivers):
                d_laps = drv_laps[drv_laps['Driver'] == d].copy()
                
                for _, lap in d_laps.iterrows():
                    compound = lap['Compound']
                    if pd.notna(compound):
                        color = tire_colors.get(compound, '#808080')
                        
                        fig_strat.add_trace(go.Scatter(
                            x=[lap['LapNumber'], lap['LapNumber']],
                            y=[idx, idx],
                            mode='markers',
                            marker=dict(
                                size=12,
                                color=color,
                                symbol='square',
                                line=dict(width=1, color='#333')
                            ),
                            showlegend=False,
                            hovertemplate=f'<b>{d}</b><br>Lap: {lap["LapNumber"]}<br>Compound: {compound}<extra></extra>'
                        ))
            
            fig_strat.update_layout(
            template="plotly_dark",
                height=300,
                yaxis=dict(
                    tickmode='array',
                    tickvals=list(range(len(selected_drivers))),
                    ticktext=selected_drivers,
                    title="Driver"
                ),
                xaxis=dict(title="Lap Number", gridcolor='#2d3340'),
                margin=dict(t=20, b=40, l=100, r=20),
            paper_bgcolor='rgba(0,0,0,0)',
            plot_bgcolor='rgba(255,255,255,0.03)'
        )
            st.plotly_chart(fig_strat, use_container_width=True)
        
        with col_strat2:
            st.markdown("####  Pit Stop Summary")
            for d in selected_drivers[:3]:  # Show top 3 selected
                stints = get_stint_analysis(laps, d)
                if stints:
                    st.markdown(f"**{d}** - {len(stints)} stint(s)")
                    for i, stint in enumerate(stints, 1):
                        st.caption(f"Stint {i}: {stint['compound']} ({stint['laps']} laps)")
        
        # 5. SPEED TRAP & PERFORMANCE ANALYSIS (Optional)
        st.markdown("---")
        
        with st.expander("Speed Trap Analysis (Click to expand - may take a few seconds)", expanded=False):
            col_speed1, col_speed2 = st.columns([2, 1])
            
            with col_speed1:
                # Speed comparison chart
                with st.spinner("Analyzing speed data..."):
                    speed_data = get_speed_trap_data(laps, selected_drivers)
                
                if speed_data:
                    drivers_list = list(speed_data.keys())
                    max_speeds = [speed_data[d]['max'] for d in drivers_list]
                    avg_max_speeds = [speed_data[d]['avg_max'] for d in drivers_list]
                    
                    fig_speed_comp = go.Figure()
                    
                    fig_speed_comp.add_trace(go.Bar(
                        x=drivers_list,
                        y=max_speeds,
                        name='Maximum Speed',
                        marker_color='#e10600',
                        text=[f"{s:.1f}" for s in max_speeds],
                        textposition='outside'
                    ))
                    
                    fig_speed_comp.add_trace(go.Bar(
                        x=drivers_list,
                        y=avg_max_speeds,
                        name='Avg Max Speed',
                        marker_color='#ff6b6b',
                        text=[f"{s:.1f}" for s in avg_max_speeds],
                        textposition='outside'
                    ))
                    
                    fig_speed_comp.update_layout(
                        template="plotly_dark",
                        height=400,
                        yaxis_title="Speed (km/h)",
                        xaxis_title="Driver",
                        barmode='group',
                        margin=dict(t=40, b=40, l=60, r=20),
                        paper_bgcolor='rgba(0,0,0,0)',
                        plot_bgcolor='rgba(255,255,255,0.03)',
                        legend=dict(orientation="h", y=1.1, x=0)
                    )
                    
                    st.plotly_chart(fig_speed_comp, use_container_width=True)
                else:
                    st.info("Speed data not available for this session")
            
            with col_speed2:
                st.markdown("#### Performance Stats")
                
                # Calculate additional statistics
                for d in selected_drivers[:5]:
                    d_laps = laps[laps['Driver'] == d]
                    clean = d_laps[(d_laps['PitOutTime'].isna()) & (d_laps['PitInTime'].isna())]
                    
                    if len(clean) > 0:
                        avg_time = clean['LapTime'].dt.total_seconds().mean()
                        st.markdown(f"**{d}**")
                        st.caption(f"Avg Pace: {fmt_time(avg_time)}")
                        st.caption(f"Laps: {len(d_laps)}")
                        st.markdown("---")
                
                st.caption("Tip: Speed data is sampled from first 10 laps for faster loading")

    else:
        st.info("Ready to analyze! Select race parameters above and click **LOAD DATA**.")

# ==============================================================================
# TAB 2: TELEMETRY DEEP DIVE
# ==============================================================================
with tab_telemetry:
    st.markdown("## Advanced Telemetry Analysis")
    
    if st.session_state.session_obj:
        session = st.session_state.session_obj
        laps = session.laps
        
        # Driver selection for telemetry
        try:
            all_drivers = session.results.sort_values(by="Position")['Abbreviation'].tolist()
        except:
            all_drivers = pd.unique(laps['Driver']).tolist()
        
        col_tel1, col_tel2 = st.columns([1, 1])
        
        with col_tel1:
            driver_1 = st.selectbox("Driver 1", all_drivers, index=0, key="tel_driver1")
        
        with col_tel2:
            driver_2 = st.selectbox("Driver 2", all_drivers, index=min(1, len(all_drivers)-1), key="tel_driver2")
        
        # Lap selection
        col_lap1, col_lap2 = st.columns([1, 1])
        
        with col_lap1:
            laps_d1 = laps[laps['Driver'] == driver_1]
            lap_options_1 = laps_d1['LapNumber'].tolist()
            
            if lap_options_1:
                # Default to fastest lap
                fastest_lap_1 = laps_d1.loc[laps_d1['LapTime'].idxmin(), 'LapNumber']
                default_idx_1 = lap_options_1.index(fastest_lap_1) if fastest_lap_1 in lap_options_1 else 0
                lap_num_1 = st.selectbox(f"{driver_1} Lap", lap_options_1, index=default_idx_1, key="tel_lap1")
            else:
                st.warning(f"No laps found for {driver_1}")
                lap_num_1 = None
        
        with col_lap2:
            laps_d2 = laps[laps['Driver'] == driver_2]
            lap_options_2 = laps_d2['LapNumber'].tolist()
            
            if lap_options_2:
                fastest_lap_2 = laps_d2.loc[laps_d2['LapTime'].idxmin(), 'LapNumber']
                default_idx_2 = lap_options_2.index(fastest_lap_2) if fastest_lap_2 in lap_options_2 else 0
                lap_num_2 = st.selectbox(f"{driver_2} Lap", lap_options_2, index=default_idx_2, key="tel_lap2")
            else:
                st.warning(f"No laps found for {driver_2}")
                lap_num_2 = None
        
        if lap_num_1 and lap_num_2:
            try:
                # Get telemetry data
                lap1 = laps[(laps['Driver'] == driver_1) & (laps['LapNumber'] == lap_num_1)].iloc[0]
                lap2 = laps[(laps['Driver'] == driver_2) & (laps['LapNumber'] == lap_num_2)].iloc[0]
                
                tel1 = lap1.get_telemetry().add_distance()
                tel2 = lap2.get_telemetry().add_distance()
                
                color1 = get_color(driver_1, session)
                color2 = get_color(driver_2, session)
                
                # Lap time comparison
                st.markdown("###  Lap Time Comparison")
                col_time1, col_time2, col_delta = st.columns(3)
                
                lap_time_1 = lap1['LapTime'].total_seconds()
                lap_time_2 = lap2['LapTime'].total_seconds()
                delta = lap_time_2 - lap_time_1
                
                col_time1.metric(f"{driver_1}", fmt_time(lap_time_1))
                col_time2.metric(f"{driver_2}", fmt_time(lap_time_2))
                col_delta.metric("Δ Delta", f"{delta:+.3f}s", delta_color="inverse")
                
                st.markdown("---")
                
                # Speed trace
                st.markdown("###  Speed Trace")
                fig_speed = go.Figure()
                
                fig_speed.add_trace(go.Scatter(
                    x=tel1['Distance'],
                    y=tel1['Speed'],
                    mode='lines',
                    name=driver_1,
                    line=dict(color=color1, width=3),
                    hovertemplate='Distance: %{x:.0f}m<br>Speed: %{y:.0f} km/h<extra></extra>'
                ))
                
                fig_speed.add_trace(go.Scatter(
                    x=tel2['Distance'],
                    y=tel2['Speed'],
                    mode='lines',
                    name=driver_2,
                    line=dict(color=color2, width=3),
                    hovertemplate='Distance: %{x:.0f}m<br>Speed: %{y:.0f} km/h<extra></extra>'
                ))
                
                fig_speed.update_layout(
                    template="plotly_dark",
                    height=400,
                    xaxis_title="Distance (m)",
                    yaxis_title="Speed (km/h)",
                    legend=dict(orientation="h", y=1.05, x=0),
                    margin=dict(t=40, b=40, l=60, r=20),
                    paper_bgcolor='rgba(0,0,0,0)',
                    plot_bgcolor='rgba(255,255,255,0.03)',
                    hovermode='x unified'
                )
                st.plotly_chart(fig_speed, use_container_width=True)
                
                # Multi-parameter telemetry
                st.markdown("###  Throttle, Brake & Gear Analysis")
                
                fig_multi = make_subplots(
                    rows=3, cols=1,
                    shared_xaxes=True,
                    vertical_spacing=0.05,
                    subplot_titles=('Throttle Position (%)', 'Brake Pressure', 'Gear')
                )
                
                # Throttle
                fig_multi.add_trace(
                    go.Scatter(x=tel1['Distance'], y=tel1['Throttle'], name=driver_1, 
                              line=dict(color=color1, width=2)),
                    row=1, col=1
                )
                fig_multi.add_trace(
                    go.Scatter(x=tel2['Distance'], y=tel2['Throttle'], name=driver_2, 
                              line=dict(color=color2, width=2)),
                    row=1, col=1
                )
                
                # Brake
                fig_multi.add_trace(
                    go.Scatter(x=tel1['Distance'], y=tel1['Brake'], name=driver_1, 
                              line=dict(color=color1, width=2), showlegend=False),
                    row=2, col=1
                )
                fig_multi.add_trace(
                    go.Scatter(x=tel2['Distance'], y=tel2['Brake'], name=driver_2, 
                              line=dict(color=color2, width=2), showlegend=False),
                    row=2, col=1
                )
                
                # Gear
                fig_multi.add_trace(
                    go.Scatter(x=tel1['Distance'], y=tel1['nGear'], name=driver_1, 
                              line=dict(color=color1, width=2), showlegend=False, mode='lines'),
                    row=3, col=1
                )
                fig_multi.add_trace(
                    go.Scatter(x=tel2['Distance'], y=tel2['nGear'], name=driver_2, 
                              line=dict(color=color2, width=2), showlegend=False, mode='lines'),
                    row=3, col=1
                )
                
                fig_multi.update_xaxes(title_text="Distance (m)", row=3, col=1, gridcolor='#2d3340')
                fig_multi.update_yaxes(gridcolor='#2d3340')
                
                fig_multi.update_layout(
                    template="plotly_dark",
                    height=700,
                    margin=dict(t=60, b=40, l=60, r=20),
                    paper_bgcolor='rgba(0,0,0,0)',
                    plot_bgcolor='rgba(255,255,255,0.03)',
                    showlegend=True,
                    legend=dict(orientation="h", y=1.08, x=0)
                )
                
                st.plotly_chart(fig_multi, use_container_width=True)
                
                # Speed heatmap on track
                st.markdown("###  Speed Heatmap")
                
                col_map1, col_map2 = st.columns(2)
                
                with col_map1:
                    st.markdown(f"**{driver_1}**")
                    fig_map1 = go.Figure()
                    fig_map1.add_trace(go.Scatter(
                        x=tel1['X'],
                        y=tel1['Y'],
                        mode='markers',
                        marker=dict(
                            size=3,
                            color=tel1['Speed'],
                            colorscale='RdYlGn',
                            showscale=True,
                            colorbar=dict(title="km/h", x=1.15)
                        ),
                        hovertemplate='Speed: %{marker.color:.0f} km/h<extra></extra>'
                    ))
                    fig_map1.update_layout(
                        template="plotly_dark",
                        height=400,
                        xaxis=dict(visible=False, scaleanchor="y", scaleratio=1),
                        yaxis=dict(visible=False),
                        margin=dict(t=20, b=20, l=20, r=20),
                        paper_bgcolor='rgba(0,0,0,0)',
                        plot_bgcolor='rgba(0,0,0,0)'
                    )
                    st.plotly_chart(fig_map1, use_container_width=True)
                
                with col_map2:
                    st.markdown(f"**{driver_2}**")
                    fig_map2 = go.Figure()
                    fig_map2.add_trace(go.Scatter(
                        x=tel2['X'],
                        y=tel2['Y'],
                        mode='markers',
                        marker=dict(
                            size=3,
                            color=tel2['Speed'],
                            colorscale='RdYlGn',
                            showscale=True,
                            colorbar=dict(title="km/h", x=1.15)
                        ),
                        hovertemplate='Speed: %{marker.color:.0f} km/h<extra></extra>'
                    ))
                    fig_map2.update_layout(
                        template="plotly_dark",
                        height=400,
                        xaxis=dict(visible=False, scaleanchor="y", scaleratio=1),
                        yaxis=dict(visible=False),
                        margin=dict(t=20, b=20, l=20, r=20),
                        paper_bgcolor='rgba(0,0,0,0)',
                        plot_bgcolor='rgba(0,0,0,0)'
                    )
                    st.plotly_chart(fig_map2, use_container_width=True)
                
                # Gap analysis over distance
                st.markdown("###  Cumulative Gap Analysis")
                
                gap_data = calculate_gap_analysis(laps, driver_1, driver_2)
                
                if gap_data is not None and len(gap_data) > 0:
                    fig_gap = go.Figure()
                    
                    fig_gap.add_trace(go.Scatter(
                        x=gap_data['LapNumber'],
                        y=gap_data['CumulativeGap'],
                        mode='lines+markers',
                        name=f'{driver_1} vs {driver_2}',
                        line=dict(color='#e10600', width=3),
                        marker=dict(size=6),
                        fill='tozeroy',
                        fillcolor='rgba(225, 6, 0, 0.1)'
                    ))
                    
                    fig_gap.add_hline(y=0, line_dash="dash", line_color="white", opacity=0.3)
                    
                    fig_gap.update_layout(
                        template="plotly_dark",
                        height=400,
                        xaxis_title="Lap Number",
                        yaxis_title=f"Gap (s) - Positive = {driver_2} ahead",
                        margin=dict(t=40, b=40, l=60, r=20),
                        paper_bgcolor='rgba(0,0,0,0)',
                        plot_bgcolor='rgba(255,255,255,0.03)',
                        hovermode='x unified'
                    )
                    
                    st.plotly_chart(fig_gap, use_container_width=True)
                    
                    # Gap statistics
                    col_gap1, col_gap2, col_gap3 = st.columns(3)
                    avg_gap = gap_data['CumulativeGap'].mean()
                    max_gap = gap_data['CumulativeGap'].max()
                    min_gap = gap_data['CumulativeGap'].min()
                    
                    col_gap1.metric("Average Gap", f"{avg_gap:+.3f}s")
                    col_gap2.metric("Maximum Gap", f"{max_gap:+.3f}s")
                    col_gap3.metric("Minimum Gap", f"{min_gap:+.3f}s")
                else:
                    st.info("Gap analysis not available - drivers may not have overlapping laps")
                
            except Exception as e:
                st.error(f"Error loading telemetry: {e}")
                st.info("Telemetry data might not be available for this session.")
    else:
        st.info("Load a session from the Race Analysis tab first!")

# ==============================================================================
# TAB 3: CHAMPIONSHIP & HISTORY
# ==============================================================================
with tab_championship:
    # 1. YEAR SELECTOR
    c_hist1, c_hist2 = st.columns([1, 4])
    with c_hist1:
        hist_year = st.selectbox("Select Season Archive", range(2025, 2017, -1), index=0, key="hist_year")

    # 2. FETCH DATA
    with st.spinner(f"Fetching full championship database for {hist_year}..."):
        stats = get_analyst_data(hist_year)

    if stats and 'drivers' in stats:
        # 3. HEADLINES
        st.markdown(f"## {hist_year} Season Overview")

        m1, m2, m3, m4 = st.columns(4)
        m1.metric("Drivers' Champion", stats['champion_driver'])
        m2.metric("Constructors' Champion", stats['champion_team'])
        m3.metric("Status", "Official Data" if hist_year < 2025 else "Projected")

        st.markdown("---")

        # 4. FULL DATA TABLES
        t_drivers, t_teams, t_calendar = st.tabs(
            ["Drivers Standings (Full Grid)", "Constructors Standings", "Season Calendar"])

        with t_drivers:
            st.dataframe(
                stats['drivers'],
                use_container_width=True,
                hide_index=True,
                height=700,  # Tall enough for 20 rows
                column_config={
                    "Pos": st.column_config.NumberColumn("Pos", format="%d"),
                    "Points": st.column_config.ProgressColumn("Points", format="%d", min_value=0, max_value=600),
                }
            )

        with t_teams:
            st.dataframe(
                stats['teams'],
                use_container_width=True,
                hide_index=True,
                column_config={
                    "Points": st.column_config.ProgressColumn("Points", format="%d", min_value=0, max_value=900),
                }
            )

        with t_calendar:
            cal = get_schedule(hist_year)
            if not cal.empty:
                # Add better column display
                display_cols = []
                for col in ['RoundNumber', 'EventName', 'Location', 'Country', 'EventDate']:
                    if col in cal.columns:
                        display_cols.append(col)
                
                if display_cols:
                    st.dataframe(
                        cal[display_cols],
                        use_container_width=True, 
                        hide_index=True,
                        height=600,
                        column_config={
                            "RoundNumber": st.column_config.NumberColumn("Round", format="%d"),
                            "EventDate": st.column_config.DateColumn("Date", format="DD/MM/YYYY")
                        }
                    )
            else:
                st.info("Calendar data unavailable for this season.")
        
        # Championship progression visualization
        st.markdown("---")
        
        # Advanced Championship Prediction Engine
        if hist_year == 2025:
            st.markdown("### Championship Prediction & Mathematical Analysis")
            
            # Points system
            POINTS_SYSTEM = {
                1: 25, 2: 18, 3: 15, 4: 12, 5: 10, 
                6: 8, 7: 6, 8: 4, 9: 2, 10: 1
            }
            FASTEST_LAP_POINT = 1
            
            top5 = stats['drivers'].head(5).copy()
            total_races = 24
            completed_races = 19
            remaining_races = total_races - completed_races
            
            leader_points = top5.iloc[0]['Points']
            leader_name = top5.iloc[0]['Driver']
            
            st.markdown("#### Detailed Prediction Analysis")
            
            # Calculate detailed predictions for each driver
            predictions = []
            for idx, driver in top5.iterrows():
                current_points = driver['Points']
                points_deficit = leader_points - current_points
                wins = driver['Wins']
                
                # Calculate podium rates
                podium_rate = wins / max(completed_races, 1)
                
                # Scenario calculations
                best_case = current_points + (remaining_races * 26)  # All wins + FL
                worst_case = current_points + (remaining_races * 1)  # All P10
                
                # Realistic scenario (based on current form)
                if wins >= 3:
                    avg_finish_points = 20  # Strong form
                elif wins >= 1:
                    avg_finish_points = 14  # Moderate form
                else:
                    avg_finish_points = 8   # Weak form
                
                realistic = current_points + (remaining_races * avg_finish_points)
                
                # Win probability calculation
                if points_deficit == 0:
                    base_prob = 55
                    form_bonus = min(30, podium_rate * 100)
                    probability = base_prob + form_bonus
                elif points_deficit <= 15:
                    probability = 40 - (points_deficit * 1.8)
                    form_bonus = podium_rate * 20
                    probability += form_bonus
                elif points_deficit <= 40:
                    probability = 20 - (points_deficit * 0.4)
                else:
                    probability = max(2, 10 - (points_deficit * 0.15))
                
                probability = min(98, max(1, probability))
                
                predictions.append({
                    'Driver': driver['Driver'],
                    'Points': current_points,
                    'Gap': -points_deficit if points_deficit < 0 else points_deficit,
                    'Wins': wins,
                    'Best': best_case,
                    'Realistic': int(realistic),
                    'Worst': worst_case,
                    'Win%': probability,
                    'AvgPts': avg_finish_points
                })
            
            pred_df = pd.DataFrame(predictions)
            
            # Display comprehensive table
            col_table, col_chart = st.columns([3, 2])
            
            with col_table:
                st.dataframe(
                    pred_df[['Driver', 'Points', 'Gap', 'Wins', 'Best', 'Realistic', 'Worst']],
                    use_container_width=True,
                    hide_index=True,
                    column_config={
                        'Points': 'Current',
                        'Gap': 'To Leader',
                        'Best': 'Best Case',
                        'Realistic': 'Realistic',
                        'Worst': 'Worst Case'
                    }
                )
                
                st.caption(f"Remaining races: {remaining_races} | Points per position: P1=25, P2=18, P3=15, P4=12, P5=10")
            
            with col_chart:
                # Probability visualization
                fig_prob = go.Figure()
                
                colors_gradient = ['#e10600', '#ff3333', '#ff6b6b', '#ffaa00', '#8b9bb4']
                
                fig_prob.add_trace(go.Bar(
                    y=pred_df['Driver'],
                    x=pred_df['Win%'],
                    orientation='h',
                    marker=dict(
                        color=colors_gradient[:len(pred_df)],
                        line=dict(color='white', width=1)
                    ),
                    text=[f"{p:.1f}%" for p in pred_df['Win%']],
                    textposition='outside'
                ))
                
                fig_prob.update_layout(
                    template="plotly_dark",
                    height=250,
                    title="Win Probability",
                    xaxis=dict(range=[0, 100], gridcolor='#2d3340', showticklabels=False),
                    yaxis=dict(autorange='reversed'),
                    margin=dict(t=40, b=20, l=100, r=40),
                    paper_bgcolor='rgba(0,0,0,0)',
                    plot_bgcolor='rgba(255,255,255,0.03)',
                    showlegend=False
                )
                
                st.plotly_chart(fig_prob, use_container_width=True)
            
            st.markdown("---")
            st.markdown("#### Detailed Scenarios Analysis")
            
            col_s1, col_s2, col_s3 = st.columns(3)
            
            # Top 3 drivers scenarios
            for idx, col in enumerate([col_s1, col_s2, col_s3]):
                if idx < len(predictions):
                    driver_pred = predictions[idx]
                    driver_name = driver_pred['Driver']
                    current = driver_pred['Points']
                    gap = driver_pred['Gap']
                    
                    with col:
                        st.markdown(f"**{driver_name}**")
                        st.markdown(f"Current: **{current} pts** | Gap: **{gap if gap > 0 else 'LEADER'} pts**")
                        
                        # Scenario 1: All wins
                        all_wins = current + (remaining_races * 26)
                        st.markdown(f"""
                        <div style='background: rgba(225,6,0,0.1); padding: 0.6rem; border-radius: 6px; margin: 0.4rem 0;'>
                            <div style='font-size: 11px; color: #8b9bb4;'>ALL P1 + FL</div>
                            <div style='font-size: 16px; color: #e10600; font-weight: 700;'>{all_wins} pts</div>
                            <div style='font-size: 10px; color: #6b7280;'>+{all_wins - current} from now</div>
</div>
""", unsafe_allow_html=True)
                        
                        # Scenario 2: All podiums (P2)
                        all_p2 = current + (remaining_races * 19)  # P2 + FL
                        st.markdown(f"""
                        <div style='background: rgba(255,255,255,0.05); padding: 0.6rem; border-radius: 6px; margin: 0.4rem 0;'>
                            <div style='font-size: 11px; color: #8b9bb4;'>ALL P2 + FL</div>
                            <div style='font-size: 16px; color: #ffd700; font-weight: 700;'>{all_p2} pts</div>
                            <div style='font-size: 10px; color: #6b7280;'>+{all_p2 - current} from now</div>
                        </div>
                        """, unsafe_allow_html=True)
                        
                        # Scenario 3: All P3
                        all_p3 = current + (remaining_races * 16)  # P3 + FL
                        st.markdown(f"""
                        <div style='background: rgba(255,255,255,0.05); padding: 0.6rem; border-radius: 6px; margin: 0.4rem 0;'>
                            <div style='font-size: 11px; color: #8b9bb4;'>ALL P3 + FL</div>
                            <div style='font-size: 16px; color: #ff9500; font-weight: 700;'>{all_p3} pts</div>
                            <div style='font-size: 10px; color: #6b7280;'>+{all_p3 - current} from now</div>
                        </div>
                        """, unsafe_allow_html=True)
                        
                        # Realistic scenario
                        realistic_pts = driver_pred['Realistic']
                        st.markdown(f"""
                        <div style='background: rgba(0,255,100,0.1); padding: 0.6rem; border-radius: 6px; margin: 0.4rem 0;'>
                            <div style='font-size: 11px; color: #8b9bb4;'>REALISTIC (AVG P{3 if driver_pred['AvgPts'] > 15 else 4 if driver_pred['AvgPts'] > 10 else 6})</div>
                            <div style='font-size: 16px; color: #00ff88; font-weight: 700;'>{realistic_pts} pts</div>
                            <div style='font-size: 10px; color: #6b7280;'>+{realistic_pts - current} from now</div>
                        </div>
                        """, unsafe_allow_html=True)
                        
                        # Championship verdict
                        can_win = "STRONG" if driver_pred['Win%'] > 40 else "POSSIBLE" if driver_pred['Win%'] > 15 else "UNLIKELY"
                        verdict_color = "#e10600" if can_win == "STRONG" else "#ffd700" if can_win == "POSSIBLE" else "#6b7280"
                        
                        st.markdown(f"""
                        <div style='text-align: center; margin-top: 0.5rem; padding: 0.4rem; background: rgba(0,0,0,0.3); border-radius: 6px;'>
                            <div style='font-size: 10px; color: #8b9bb4;'>CHAMPIONSHIP</div>
                            <div style='font-size: 14px; color: {verdict_color}; font-weight: 800;'>{can_win}</div>
                            <div style='font-size: 11px; color: #ffffff;'>{driver_pred['Win%']:.1f}%</div>
                        </div>
                        """, unsafe_allow_html=True)
            
            st.markdown("---")
            st.caption("Note: Predictions based on mathematical scenarios. Best Case assumes all wins with fastest lap. Realistic scenario based on current average performance. Points: P1=25, P2=18, P3=15, P4=12, P5=10, P6=8, P7=6, P8=4, P9=2, P10=1, FL=+1")
        
        st.markdown("---")
        st.markdown("### Championship Progression")
        
        col_prog1, col_prog2 = st.columns(2)
        
        with col_prog1:
            st.markdown("#### Drivers' Championship Top 10")
            if 'drivers' in stats:
                top10_drivers = stats['drivers'].head(10)
                
                fig_drivers = go.Figure()
                fig_drivers.add_trace(go.Bar(
                    y=top10_drivers['Driver'],
                    x=top10_drivers['Points'],
                    orientation='h',
                    marker_color='#e10600',
                    text=top10_drivers['Points'],
                    textposition='outside'
                ))
                
                fig_drivers.update_layout(
                    template="plotly_dark",
                    height=500,
                    xaxis_title="Points",
                    yaxis_title="",
                    margin=dict(t=20, b=40, l=150, r=40),
                    paper_bgcolor='rgba(0,0,0,0)',
                    plot_bgcolor='rgba(255,255,255,0.03)',
                    yaxis=dict(autorange='reversed')
                )
                
                st.plotly_chart(fig_drivers, use_container_width=True)
        
        with col_prog2:
            st.markdown("#### Constructors' Championship")
            if 'teams' in stats:
                teams_data = stats['teams']
                
                fig_teams = go.Figure()
                fig_teams.add_trace(go.Bar(
                    y=teams_data['Team'],
                    x=teams_data['Points'],
                    orientation='h',
                    marker_color='#ff6b6b',
                    text=teams_data['Points'],
                    textposition='outside'
                ))
                
                fig_teams.update_layout(
                    template="plotly_dark",
                    height=500,
                    xaxis_title="Points",
                    yaxis_title="",
                    margin=dict(t=20, b=40, l=150, r=40),
                    paper_bgcolor='rgba(0,0,0,0)',
                    plot_bgcolor='rgba(255,255,255,0.03)',
                    yaxis=dict(autorange='reversed')
                )
                
                st.plotly_chart(fig_teams, use_container_width=True)
    
    else:
        st.error("Could not fetch data from Ergast API. Please try again later.")

# ==============================================================================
# TAB 4: DRIVER COMPARISON
# ==============================================================================
with tab_comparison:
    st.markdown("## Head-to-Head Driver Comparison")
    
    if st.session_state.session_obj:
        session = st.session_state.session_obj
        laps = session.laps
        
        try:
            all_drivers = session.results.sort_values(by="Position")['Abbreviation'].tolist()
        except:
            all_drivers = pd.unique(laps['Driver']).tolist()
        
        # Driver selection
        col_comp1, col_comp2 = st.columns(2)
        
        with col_comp1:
            comp_driver1 = st.selectbox("Select Driver 1", all_drivers, index=0, key="comp_d1")
        
        with col_comp2:
            comp_driver2 = st.selectbox("Select Driver 2", all_drivers, 
                                       index=min(1, len(all_drivers)-1), key="comp_d2")
        
        if comp_driver1 and comp_driver2:
            laps1 = laps[laps['Driver'] == comp_driver1].copy()
            laps2 = laps[laps['Driver'] == comp_driver2].copy()
            
            color1 = get_color(comp_driver1, session)
            color2 = get_color(comp_driver2, session)
            
            # Performance metrics
            st.markdown("###  Performance Metrics")
            
            col_m1, col_m2, col_m3, col_m4 = st.columns(4)
            
            # Fastest lap
            fastest1 = laps1['LapTime'].min().total_seconds() if len(laps1) > 0 else 0
            fastest2 = laps2['LapTime'].min().total_seconds() if len(laps2) > 0 else 0
            
            col_m1.metric(f"{comp_driver1} Fastest", fmt_time(fastest1))
            col_m2.metric(f"{comp_driver2} Fastest", fmt_time(fastest2))
            
            # Average pace (clean laps only)
            clean1 = laps1[(laps1['PitOutTime'].isna()) & (laps1['PitInTime'].isna())]
            clean2 = laps2[(laps2['PitOutTime'].isna()) & (laps2['PitInTime'].isna())]
            
            avg1 = clean1['LapTime'].dt.total_seconds().mean() if len(clean1) > 0 else 0
            avg2 = clean2['LapTime'].dt.total_seconds().mean() if len(clean2) > 0 else 0
            
            col_m3.metric(f"{comp_driver1} Avg", fmt_time(avg1))
            col_m4.metric(f"{comp_driver2} Avg", fmt_time(avg2))
            
            st.markdown("---")
            
            # Consistency analysis
            st.markdown("###  Consistency Analysis")
            
            cons1 = calculate_race_consistency(laps, comp_driver1)
            cons2 = calculate_race_consistency(laps, comp_driver2)
            
            if cons1 and cons2:
                col_cons1, col_cons2 = st.columns(2)
                
                with col_cons1:
                    st.markdown(f"**{comp_driver1}**")
                    st.metric("Consistency Score", f"{cons1['consistency_score']:.1f}%")
                    st.metric("Std Deviation", f"{cons1['std_dev']:.3f}s")
                
                with col_cons2:
                    st.markdown(f"**{comp_driver2}**")
                    st.metric("Consistency Score", f"{cons2['consistency_score']:.1f}%")
                    st.metric("Std Deviation", f"{cons2['std_dev']:.3f}s")
            
            st.markdown("---")
            
            # Sector comparison
            st.markdown("###  Sector Performance")
            
            sector_data = analyze_sector_performance(laps, [comp_driver1, comp_driver2])
            
            if sector_data:
                # Create sector comparison chart
                sectors = ['S1', 'S2', 'S3']
                
                if comp_driver1 in sector_data and comp_driver2 in sector_data:
                    times1 = [sector_data[comp_driver1][s] for s in sectors]
                    times2 = [sector_data[comp_driver2][s] for s in sectors]
                    
                    fig_sectors = go.Figure()
                    
                    fig_sectors.add_trace(go.Bar(
                        x=sectors,
                        y=times1,
                        name=comp_driver1,
                        marker_color=color1,
                        text=[f"{t:.3f}s" for t in times1],
                        textposition='outside'
                    ))
                    
                    fig_sectors.add_trace(go.Bar(
                        x=sectors,
                        y=times2,
                        name=comp_driver2,
                        marker_color=color2,
                        text=[f"{t:.3f}s" for t in times2],
                        textposition='outside'
                    ))
                    
                    fig_sectors.update_layout(
                        template="plotly_dark",
                        height=400,
                        barmode='group',
                        yaxis_title="Time (seconds)",
                        xaxis_title="Sector",
                        margin=dict(t=40, b=40, l=60, r=20),
                        paper_bgcolor='rgba(0,0,0,0)',
                        plot_bgcolor='rgba(255,255,255,0.03)',
                        legend=dict(orientation="h", y=1.1, x=0)
                    )
                    
                    st.plotly_chart(fig_sectors, use_container_width=True)
                    
                    # Sector delta table
                    st.markdown("#### Sector Deltas")
                    delta_data = []
                    for s in sectors:
                        delta = times2[sectors.index(s)] - times1[sectors.index(s)]
                        delta_data.append({
                            'Sector': s,
                            comp_driver1: f"{times1[sectors.index(s)]:.3f}s",
                            comp_driver2: f"{times2[sectors.index(s)]:.3f}s",
                            'Delta': f"{delta:+.3f}s"
                        })
                    
                    st.dataframe(pd.DataFrame(delta_data), use_container_width=True, hide_index=True)
            
            st.markdown("---")
            
            # Tire degradation comparison
            st.markdown("###  Tire Degradation Analysis")
            
            deg1 = calculate_tire_degradation(laps, comp_driver1)
            deg2 = calculate_tire_degradation(laps, comp_driver2)
            
            if deg1 or deg2:
                col_tire1, col_tire2 = st.columns(2)
                
                with col_tire1:
                    st.markdown(f"**{comp_driver1}**")
                    if deg1:
                        for compound, data in deg1.items():
                            st.metric(
                                f"{compound}", 
                                f"{data['rate']:+.3f}s/lap",
                                f"{data['laps']} laps"
                            )
                    else:
                        st.info("No degradation data")
                
                with col_tire2:
                    st.markdown(f"**{comp_driver2}**")
                    if deg2:
                        for compound, data in deg2.items():
                            st.metric(
                                f"{compound}", 
                                f"{data['rate']:+.3f}s/lap",
                                f"{data['laps']} laps"
                            )
                    else:
                        st.info("No degradation data")
            
            st.markdown("---")
            
            # Position changes over race
            st.markdown("###  Race Position Progression")
            
            try:
                # Get position data for both drivers
                pos1 = laps1[['LapNumber', 'Position']].copy()
                pos2 = laps2[['LapNumber', 'Position']].copy()
                
                fig_pos = go.Figure()
                
                fig_pos.add_trace(go.Scatter(
                    x=pos1['LapNumber'],
                    y=pos1['Position'],
                    mode='lines+markers',
                    name=comp_driver1,
                    line=dict(color=color1, width=3),
                    marker=dict(size=6)
                ))
                
                fig_pos.add_trace(go.Scatter(
                    x=pos2['LapNumber'],
                    y=pos2['Position'],
                    mode='lines+markers',
                    name=comp_driver2,
                    line=dict(color=color2, width=3),
                    marker=dict(size=6)
                ))
                
                fig_pos.update_layout(
                    template="plotly_dark",
                    height=400,
                    yaxis=dict(
                        title="Position",
                        autorange='reversed',  # 1st place at top
                        gridcolor='#2d3340'
                    ),
                    xaxis=dict(title="Lap Number", gridcolor='#2d3340'),
                    margin=dict(t=40, b=40, l=60, r=20),
                    paper_bgcolor='rgba(0,0,0,0)',
                    plot_bgcolor='rgba(255,255,255,0.03)',
                    legend=dict(orientation="h", y=1.1, x=0),
                    hovermode='x unified'
                )
                
                st.plotly_chart(fig_pos, use_container_width=True)
            
            except Exception as e:
                st.info("Position progression data not available")
            
            st.markdown("---")
            
            # Head-to-head lap time comparison
            st.markdown("### Lap-by-Lap Comparison")
            
            try:
                # Get clean laps for both drivers
                clean1 = laps1[(laps1['PitOutTime'].isna()) & (laps1['PitInTime'].isna())].copy()
                clean2 = laps2[(laps2['PitOutTime'].isna()) & (laps2['PitInTime'].isna())].copy()
                
                if len(clean1) > 0 and len(clean2) > 0:
                    # Merge data
                    comparison = pd.merge(
                        clean1[['LapNumber', 'LapTimeSec']],
                        clean2[['LapNumber', 'LapTimeSec']],
                        on='LapNumber',
                        suffixes=('_1', '_2')
                    )
                    
                    comparison['Delta'] = comparison['LapTimeSec_2'] - comparison['LapTimeSec_1']
                    
                    fig_h2h = go.Figure()
                    
                    # Color based on who was faster
                    colors = [color1 if d < 0 else color2 for d in comparison['Delta']]
                    
                    fig_h2h.add_trace(go.Bar(
                        x=comparison['LapNumber'],
                        y=comparison['Delta'].abs(),
                        marker_color=colors,
                        text=[f"{d:+.3f}s" for d in comparison['Delta']],
                        textposition='outside',
                        hovertemplate='Lap: %{x}<br>Delta: %{text}<extra></extra>'
                    ))
                    
                    fig_h2h.update_layout(
                        template="plotly_dark",
                        height=400,
                        xaxis_title="Lap Number",
                        yaxis_title="Time Delta (seconds)",
                        margin=dict(t=40, b=40, l=60, r=20),
                        paper_bgcolor='rgba(0,0,0,0)',
                        plot_bgcolor='rgba(255,255,255,0.03)',
                        showlegend=False
                    )
                    
                    st.plotly_chart(fig_h2h, use_container_width=True)
                    
                    # Summary statistics
                    st.markdown("#### Head-to-Head Summary")
                    col_sum1, col_sum2, col_sum3, col_sum4 = st.columns(4)
                    
                    faster_laps_1 = (comparison['Delta'] < 0).sum()
                    faster_laps_2 = (comparison['Delta'] > 0).sum()
                    avg_delta = comparison['Delta'].mean()
                    
                    col_sum1.metric(f"{comp_driver1} Faster", f"{faster_laps_1} laps")
                    col_sum2.metric(f"{comp_driver2} Faster", f"{faster_laps_2} laps")
                    col_sum3.metric("Average Delta", f"{avg_delta:+.3f}s")
                    col_sum4.metric("Biggest Gap", f"{comparison['Delta'].abs().max():.3f}s")
                    
            except Exception as e:
                st.info("Lap-by-lap comparison not available")
    
    else:
        st.info("Load a session from the Race Analysis tab first!")

# --- FOOTER ---
st.markdown("---")
st.markdown("<br>", unsafe_allow_html=True)

col_f1, col_f2, col_f3 = st.columns([1, 2, 1])
with col_f2:
    st.markdown("<p style='text-align: center; color: #e10600; font-size: 16px; font-weight: 700; margin-bottom: 0.5rem;'>Formula 1 Analysis System</p>", unsafe_allow_html=True)
    st.markdown("<p style='text-align: center; color: #8b9bb4; font-size: 11px; margin: 0.3rem 0;'>FastF1 API • Ergast API • Official F1 Timing</p>", unsafe_allow_html=True)
    st.markdown("<p style='text-align: center; color: #6b7280; font-size: 10px; font-style: italic; margin-top: 0.5rem;'>Unofficial tool • For educational purposes only</p>", unsafe_allow_html=True)