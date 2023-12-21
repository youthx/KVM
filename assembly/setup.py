from setuptools import setup, find_packages

setup(
  name='ktro',
  version='0.0.1',
  packages=find_packages(),
  entry_points={
    'console_scripts': [
      'ktroasm=ktro.ktroasm:main'
    ]
  },
  install_requires=[
      'lark',
      # other dependencies...
  ]
)