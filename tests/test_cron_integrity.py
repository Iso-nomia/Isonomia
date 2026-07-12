import importlib.util, sys, os


def test_import_builder():
    path = os.path.join(os.getcwd(), 'jobs', 'favorites_builder.ts')
    assert os.path.exists(path)
