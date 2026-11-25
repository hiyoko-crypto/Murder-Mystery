'''
main function used to generate and validate detective scenarios
USAGE: python main.py
NEEDED: a json file to fill, a template, an example(chosen). the model(local or remote)
TODO: a way to auto-generate seed for json file(e.g. the content or a thought of scenario)
if there is null input, more than 32b model may work. if there are some beautiful seeds as input, more than 14b model is recommended
'''


import os

os.environ["LOCAL_API_KEY"] = "EMPTY"

from auto_sceneraio import generate_scenario
from validator import validate_scenario

FILE_DIR_PATH = "scenarios/auto/"
FILE_TO_FILL = "input.json"
DATA_DIR = "scenarios/data/"

from prompt import MY_PROMPT
result = generate_scenario(
    prompt=MY_PROMPT,
    input_file=FILE_DIR_PATH + FILE_TO_FILL,
    template_json=DATA_DIR + "template.json",
    model="Qwen/Qwen2.5-7B",  
    base_url="http://localhost:11434/v1",  
    api_key_env="LOCAL_API_KEY"
)

report = validate_scenario(result, FILE_DIR_PATH + FILE_TO_FILL)

print(report["status"])
print(report["score"])
print(report["proof_groups"])