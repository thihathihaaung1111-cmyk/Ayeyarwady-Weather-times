import json
import datetime
import requests
from bs4 import BeautifulSoup

def fetch_dmh_flood_news():
    url = "https://www.dmh.gov.mm/"
    warning_text = "လက်ရှိ ဧရာဝတီတိုင်းအတွင်း မြစ်ရေမှတ်များ စိုးရိမ်ရေမှတ်အောက်တွင် တည်ငြိမ်လျက်ရှိပါသည်။"
    
    try:
        response = requests.get(url, timeout=10)
        if response.status_status == 200:
            soup = BeautifulSoup(response.text, 'html.parser')
            # DMH Website မှ သတိပေးချက် သို့မဟုတ် သတင်းခဲျုင်းများကို ဆွဲယူရန် logic
            paragraphs = soup.find_all('p')
            for p in paragraphs:
                if 'ရေကြီး' in p.text or 'စိုးရိမ်ရေမှတ်' in p.text:
                    warning_text = p.text.strip()
                    break
    except Exception as e:
        print("Scraping Error:", e)

    data = {
        "updated_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "warning": warning_text,
        "regions": {
            "Hinthada": "စိုးရိမ်ရေမှတ်အောက်",
            "Nyaungdon": "စိုးရိမ်ရေမှတ်အောက်",
            "Pathein": "ပုံမှန်ဒီရေအတက်အကျရှိ"
        }
    }

    with open("flood-data.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)

if __name__ == "__main__":
    fetch_dmh_flood_news()
