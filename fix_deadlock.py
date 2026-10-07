with open('dist/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

import re

# Find the circular dependency inside init_workspace$1
# It contains: await init_script$1(),
if 'await init_script$1(),' in content:
    # Comment it out or replace it with a non-blocking invocation/noop
    content = content.replace(
        'await init_script$1(),', 
        '/* bypassed circular await init_script$1() */'
    )
    with open('dist/index.html', 'w', encoding='utf-8') as f:
        f.write(content)
    print('Successfully bypassed circular deadlock in init_workspace$1!')
else:
    print('Could not find exact circular call pattern.')
