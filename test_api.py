import urllib.request
import urllib.error
import base64
import json
import os

API_URL = "http://localhost:8081/api/saas/clash-detection"
IFC_DIR = "/Users/louistrue/Development/ifcclash/ifc"

def encode_file(file_path):
    with open(file_path, "rb") as f:
        return base64.b64encode(f.read()).decode('utf-8')

def test_clash_detection():
    files = []
    # Define the files we want to use
    file_names = [
        "4_DT.ifc",
        "01_BIMcollab_Example_ARC.ifc",
        "02_BIMcollab_Example_STR_random_C_ebkp.ifc"
    ]
    
    print("Encoding files...")
    for name in file_names:
        path = os.path.join(IFC_DIR, name)
        if os.path.exists(path):
            content = encode_file(path)
            files.append({
                "name": name,
                "content": content
            })
        else:
            print(f"File not found: {path}")
            return

    # Configure clash settings as requested:
    # 1. 4_DT.ifc standalone (allow touching elements)
    # 2. ARC vs STR (collision)
    # 3. ARC vs STR (clearance check)
    payload = {
        "files": files,
        "clashSettings": [
            {
                "name": "4DT Standalone - Allow Touching",
                "a": [{"file": "4_DT.ifc"}],
                "b": [{"file": "4_DT.ifc"}],
                "mode": "collision",
                "allow_touching": True,
                "tolerance": 0.01
            },
            {
                "name": "ARC vs STR - Collision",
                "a": [{"file": "01_BIMcollab_Example_ARC.ifc"}],
                "b": [{"file": "02_BIMcollab_Example_STR_random_C_ebkp.ifc"}],
                "mode": "collision",
                "tolerance": 0.01
            },
            {
                "name": "ARC vs STR - Clearance 50mm",
                "a": [{"file": "01_BIMcollab_Example_ARC.ifc"}],
                "b": [{"file": "02_BIMcollab_Example_STR_random_C_ebkp.ifc"}],
                "mode": "clearance",
                "clearance": 0.05,
                "check_all": True
            }
        ]
    }

    print(f"Sending request to {API_URL}...")
    try:
        data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(API_URL, data=data, headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(req) as response:
            print(f"Status Code: {response.getcode()}")
            response_body = response.read().decode('utf-8')
            print("Success!")
            # Parse JSON to pretty print
            parsed = json.loads(response_body)
            
            # Print summary
            print("\n" + "="*60)
            print("CLASH DETECTION SUMMARY")
            print("="*60)
            for i, result in enumerate(parsed['results'], 1):
                clash_count = len(result.get('clashes', {}))
                print(f"\nTest {i}: {result['name']}")
                print(f"  Mode: {result.get('mode', 'N/A')}")
                if 'allow_touching' in result:
                    print(f"  Allow Touching: {result['allow_touching']}")
                if 'clearance' in result:
                    print(f"  Clearance Distance: {result['clearance']}m")
                print(f"  Clashes Found: {clash_count}")
            print("\n" + "="*60)
            
            # Optionally print full JSON (commented out to reduce output)
            # print("\nFull Response:")
            # print(json.dumps(parsed, indent=2))
            
    except urllib.error.HTTPError as e:
        print(f"HTTP Error: {e.code}")
        print(e.read().decode('utf-8'))
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_clash_detection()
